const mongoose = require('mongoose');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const User = require('../models/User.model');
const { lockFunds, releaseFunds, refundFunds, PLATFORM_FEE_PERCENT } = require('../utils/escrow');
const ApiError = require('../utils/apiError');

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Shape an order for API responses — populate refs cleanly.
 */
const populateOrder = (query) =>
  query
    .populate('buyer', 'name email avatar')
    .populate('seller', 'name email avatar sellerProfile.shopName')
    .populate('items.product', 'title images category');

// ── Controllers ───────────────────────────────────────────────────

/**
 * POST /api/orders
 * Buyer only.
 *
 * Flow (all inside one MongoDB session):
 *   1. Validate items + fetch products
 *   2. Check buyer wallet has sufficient balance
 *   3. Atomically decrement stock for every item
 *   4. Lock funds in escrow
 *   5. Create Order document
 *
 * If ANY step fails the session rolls back — stock is restored,
 * wallet is untouched, no order is created.
 */
const placeOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, shippingAddress } = req.body;

    // ── Input validation ─────────────────────────────────────────
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return next(ApiError.badRequest('Order must contain at least one item.'));
    }

    if (!shippingAddress?.address || !shippingAddress?.city || !shippingAddress?.phone) {
      await session.abortTransaction();
      return next(ApiError.badRequest('Shipping address (address, city, phone) is required.'));
    }

    // ── Fetch + validate every product ───────────────────────────
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
      isBanned: false,
    }).session(session);

    if (products.length !== productIds.length) {
      await session.abortTransaction();
      return next(ApiError.badRequest('One or more products are unavailable or do not exist.'));
    }

    // Map for O(1) lookup
    const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

    // ── Validate each item + compute totals ───────────────────────
    const orderItems = [];
    let totalAmount = 0;
    let sellerId = null;

    for (const item of items) {
      const product = productMap[item.productId];
      if (!product) {
        await session.abortTransaction();
        return next(ApiError.badRequest(`Product ${item.productId} not found.`));
      }

      // Enforce single-seller orders (escrow must know who to pay)
      if (sellerId && product.seller.toString() !== sellerId) {
        await session.abortTransaction();
        return next(
          ApiError.badRequest(
            'All items in one order must be from the same seller. ' +
              'Please place separate orders for different sellers.'
          )
        );
      }
      sellerId = product.seller.toString();

      // Buyer cannot order their own product
      if (sellerId === req.user._id.toString()) {
        await session.abortTransaction();
        return next(ApiError.badRequest('You cannot purchase your own products.'));
      }

      const qty = parseInt(item.quantity, 10) || 1;
      if (qty < 1 || qty > 10) {
        await session.abortTransaction();
        return next(ApiError.badRequest(`Quantity for "${product.title}" must be between 1 and 10.`));
      }

      if (product.stock < qty) {
        await session.abortTransaction();
        return next(
          ApiError.badRequest(
            `Insufficient stock for "${product.title}". Available: ${product.stock}, requested: ${qty}.`
          )
        );
      }

      const lineTotal = parseFloat((product.price * qty).toFixed(2));
      totalAmount += lineTotal;

      orderItems.push({
        product: product._id,
        title: product.title,         // snapshot at purchase time
        price: product.price,          // snapshot at purchase time
        quantity: qty,
        image: product.images?.[0] || '',
      });
    }

    totalAmount = parseFloat(totalAmount.toFixed(2));

    // ── Check buyer has sufficient wallet balance ─────────────────
    const buyer = await User.findById(req.user._id).session(session);
    const available = parseFloat(
      (buyer.wallet.balance - buyer.wallet.escrowBalance).toFixed(2)
    );

    if (available < totalAmount) {
      await session.abortTransaction();
      return next(
        ApiError.badRequest(
          `Insufficient wallet balance. Required: ৳${totalAmount}, Available: ৳${available}. ` +
            `Please top up your wallet.`
        )
      );
    }

    // ── Atomically decrement stock for all items ──────────────────
    for (const item of orderItems) {
      const decremented = await Product.findOneAndUpdate(
        {
          _id: item.product,
          stock: { $gte: item.quantity },
          isActive: true,
          isBanned: false,
        },
        {
          $inc: { stock: -item.quantity },
          $set: { hasSold: true },
        },
        { new: true, session }
      );

      if (!decremented) {
        await session.abortTransaction();
        return next(
          ApiError.badRequest(
            `"${item.title}" just went out of stock. Please remove it and try again.`
          )
        );
      }

      // Auto-deactivate if stock hit zero
      if (decremented.stock === 0) {
        await Product.findByIdAndUpdate(
          item.product,
          { isActive: false },
          { session }
        );
      }
    }

    // ── Compute escrow financials ─────────────────────────────────
    const platformFee = parseFloat(((totalAmount * PLATFORM_FEE_PERCENT) / 100).toFixed(2));
    const sellerReceives = parseFloat((totalAmount - platformFee).toFixed(2));

    // ── Create the order ──────────────────────────────────────────
    const [order] = await Order.create(
      [
        {
          buyer: req.user._id,
          seller: sellerId,
          items: orderItems,
          totalAmount,
          platformFee,
          sellerReceives,
          escrowStatus: 'LOCKED',
          shippingAddress: {
            fullName: shippingAddress.fullName || buyer.name,
            address: shippingAddress.address,
            city: shippingAddress.city,
            district: shippingAddress.district || '',
            postalCode: shippingAddress.postalCode || '',
            phone: shippingAddress.phone,
          },
          escrowHistory: [
            {
              from: null,
              to: 'LOCKED',
              actor: req.user._id,
              actorRole: 'buyer',
              note: 'Order placed — funds locked in escrow.',
              timestamp: new Date(),
            },
          ],
        },
      ],
      { session }
    );

    // ── Lock buyer funds in escrow ────────────────────────────────
    await lockFunds(session, {
      buyerId: req.user._id,
      amount: totalAmount,
      orderId: order._id,
    });

    // ── Commit everything ─────────────────────────────────────────
    await session.commitTransaction();

    const populated = await populateOrder(Order.findById(order._id));

    return res.status(201).json({
      status: 'success',
      message: 'Order placed successfully. Funds are held in escrow.',
      data: { order: populated },
    });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * GET /api/orders
 * Buyer: sees their purchases. Seller: sees their sales.
 * Admin: sees all (handled in admin controller).
 */
const getOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.user.role === 'buyer') filter.buyer = req.user._id;
    else if (req.user.role === 'seller') filter.seller = req.user._id;

    if (req.query.status) filter.escrowStatus = req.query.status.toUpperCase();

    const [orders, total] = await Promise.all([
      populateOrder(Order.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: 'success',
      data: {
        orders,
        pagination: {
          total, page, limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/seller/analytics
 * Seller only — aggregate analytics for dashboard.
 */
const getSellerAnalytics = async (req, res, next) => {
  try {
    const sellerId = req.user._id;

    // We can run an aggregation pipeline to get everything in one pass,
    // or just run a few queries. Aggregation is cleaner.
    const stats = await Order.aggregate([
      { $match: { seller: sellerId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$escrowStatus', 'RELEASED'] }, 1, 0] }
          },
          pendingOrders: {
            $sum: { $cond: [{ $in: ['$escrowStatus', ['LOCKED', 'SHIPPED', 'ON_HOLD']] }, 1, 0] }
          },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ['$escrowStatus', 'RELEASED'] }, '$sellerReceives', 0] }
          }
        }
      }
    ]);

    const analytics = stats[0] || {
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      totalRevenue: 0
    };

    // Get 5 recent orders for the dashboard
    const recentOrders = await Order.find({ seller: sellerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('buyer', 'name email avatar')
      .populate('items.product', 'title images');

    return res.status(200).json({
      status: 'success',
      data: {
        analytics,
        recentOrders,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/:id
 * Buyer (own order), Seller (own sale), or Admin.
 */
const getOrder = async (req, res, next) => {
  try {
    const order = await populateOrder(Order.findById(req.params.id));
    if (!order) return next(ApiError.notFound('Order'));

    const isBuyer = order.buyer._id.toString() === req.user._id.toString();
    const isSeller = order.seller._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return next(ApiError.forbidden('You do not have access to this order.'));
    }

    return res.status(200).json({
      status: 'success',
      data: { order },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/ship
 * Seller only — mark order as shipped.
 * Transition: LOCKED → SHIPPED
 */
const markShipped = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) { await session.abortTransaction(); return next(ApiError.notFound('Order')); }

    if (order.seller.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      return next(ApiError.forbidden('Only the seller can mark an order as shipped.'));
    }

    // Validates transition, appends to escrowHistory, sets shippedAt
    order.transitionEscrow('SHIPPED', req.user, req.body.note || '');

    if (req.body.trackingNumber) {
      order.trackingNumber = req.body.trackingNumber.trim();
    }

    await order.save({ session });
    await session.commitTransaction();

    const populated = await populateOrder(Order.findById(order._id));
    return res.status(200).json({
      status: 'success',
      message: 'Order marked as shipped. Awaiting buyer confirmation.',
      data: { order: populated },
    });
  } catch (err) {
    await session.abortTransaction();
    // transitionEscrow throws a plain Error — convert to ApiError
    if (!err.isOperational) return next(ApiError.badRequest(err.message));
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * PATCH /api/orders/:id/confirm-delivery
 * Buyer only — confirm receipt of goods.
 * Transition: SHIPPED → DELIVERED → immediately RELEASED
 *
 * We go straight to RELEASED (no separate trigger needed for MVP).
 * Funds are atomically transferred to seller.
 */
const confirmDelivery = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) { await session.abortTransaction(); return next(ApiError.notFound('Order')); }

    if (order.buyer.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      return next(ApiError.forbidden('Only the buyer can confirm delivery.'));
    }

    // SHIPPED → DELIVERED
    order.transitionEscrow('DELIVERED', req.user, 'Buyer confirmed receipt.');

    // DELIVERED → RELEASED (immediate in MVP — can add review-gate later)
    order.transitionEscrow('RELEASED', req.user, 'Funds released to seller automatically on delivery confirmation.');

    // ── Atomic wallet release ─────────────────────────────────────
    const { sellerReceives, platformFee } = await releaseFunds(session, {
      buyerId: order.buyer,
      sellerId: order.seller,
      amount: order.totalAmount,
      orderId: order._id,
      initiatedBy: req.user._id,
    });

    // Update seller's total sales count
    await User.findByIdAndUpdate(
      order.seller,
      { $inc: { 'sellerProfile.totalSales': 1 } },
      { session }
    );

    order.sellerReceives = sellerReceives;
    order.platformFee = platformFee;
    await order.save({ session });
    await session.commitTransaction();

    const populated = await populateOrder(Order.findById(order._id));
    return res.status(200).json({
      status: 'success',
      message: `Delivery confirmed. ৳${sellerReceives} released to seller.`,
      data: { order: populated },
    });
  } catch (err) {
    await session.abortTransaction();
    if (!err.isOperational) return next(ApiError.badRequest(err.message));
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * PATCH /api/orders/:id/cancel
 * Buyer only — cancel before seller ships (LOCKED state only).
 * Refunds full amount to buyer immediately.
 */
const cancelOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) { await session.abortTransaction(); return next(ApiError.notFound('Order')); }

    if (order.buyer.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      return next(ApiError.forbidden('Only the buyer can cancel their order.'));
    }

    if (order.escrowStatus !== 'LOCKED') {
      await session.abortTransaction();
      return next(
        ApiError.badRequest(
          `Cannot cancel an order that is already ${order.escrowStatus}. ` +
            'Contact support to raise a dispute.'
        )
      );
    }

    // Transition: LOCKED → ON_HOLD → REFUNDED
    order.transitionEscrow('ON_HOLD', req.user, 'Buyer cancelled before shipment.');
    order.transitionEscrow('REFUNDED', req.user, 'Full refund issued — order cancelled before shipment.');

    // Refund buyer
    await refundFunds(session, {
      buyerId: order.buyer,
      amount: order.totalAmount,
      orderId: order._id,
      initiatedBy: req.user._id,
    });

    // Restore stock for each item
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        {
          $inc: { stock: item.quantity },
          $set: { isActive: true }, // reactivate if it was zero-stocked
        },
        { session }
      );
    }

    await order.save({ session });
    await session.commitTransaction();

    const populated = await populateOrder(Order.findById(order._id));
    return res.status(200).json({
      status: 'success',
      message: `Order cancelled. ৳${order.totalAmount} refunded to your wallet.`,
      data: { order: populated },
    });
  } catch (err) {
    await session.abortTransaction();
    if (!err.isOperational) return next(ApiError.badRequest(err.message));
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * GET /api/orders/:id/receipt
 * Buyer (own order) or Seller (own sale) — download PDF receipt.
 * Uses pdfkit to generate receipt.
 */
const downloadReceipt = async (req, res, next) => {
  try {
    const { generateReceiptPdf } = require('../utils/generateReceiptPdf');

    const order = await populateOrder(Order.findById(req.params.id));
    if (!order) return next(ApiError.notFound('Order'));

    // Access control — buyer or seller of this order only
    const isBuyer  = order.buyer._id.toString()  === req.user._id.toString();
    const isSeller = order.seller._id.toString() === req.user._id.toString();
    const isAdmin  = req.user.role === 'admin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return next(ApiError.forbidden('You do not have access to this receipt.'));
    }

    try {
      const pdfBuffer = await generateReceiptPdf(order.toObject());

      const filename  = `TrustTrade-Receipt-${order._id.toString().slice(-8).toUpperCase()}.pdf`;

      res.setHeader('Content-Type',        'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length',      pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (err) {
      console.error('PDF generation error:', err);
      return next(ApiError.internal('Failed to generate receipt. Please try again.'));
    }
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/create-for-payment
 * ────────────────────────────────────────────────────────────────
 * Creates an order intended for SSLCommerz payment (not wallet).
 *
 * SECURITY STANDARD #1: SERVER-SIDE PRICE VALIDATION
 * The frontend does NOT pass any price/amount. We fetch verified
 * product prices from MongoDB and compute the total server-side.
 *
 * Flow:
 *   1. Validate items + fetch products (server-side price)
 *   2. Atomically decrement stock
 *   3. Create Order with paymentStatus: 'PENDING', escrowStatus: 'PENDING_PAYMENT'
 *   4. Return orderId — frontend then calls POST /api/payment/initiate
 *
 * NO wallet deduction happens here. Funds are only locked after
 * SSLCommerz confirms payment via the IPN webhook.
 */
const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, shippingAddress } = req.body;

    // ── Input validation ─────────────────────────────────────────
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return next(ApiError.badRequest('Order must contain at least one item.'));
    }

    if (!shippingAddress?.address || !shippingAddress?.city || !shippingAddress?.phone) {
      await session.abortTransaction();
      return next(ApiError.badRequest('Shipping address (address, city, phone) is required.'));
    }

    // ── Fetch + validate every product (SERVER-SIDE PRICE) ──────
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
      isBanned: false,
    }).session(session);

    if (products.length !== productIds.length) {
      await session.abortTransaction();
      return next(ApiError.badRequest('One or more products are unavailable or do not exist.'));
    }

    const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

    // ── Build order items + compute total (from DB prices) ──────
    const orderItems = [];
    let totalAmount = 0;
    let sellerId = null;

    for (const item of items) {
      const product = productMap[item.productId];
      if (!product) {
        await session.abortTransaction();
        return next(ApiError.badRequest(`Product ${item.productId} not found.`));
      }

      // Enforce single-seller orders
      if (sellerId && product.seller.toString() !== sellerId) {
        await session.abortTransaction();
        return next(
          ApiError.badRequest(
            'All items in one order must be from the same seller. ' +
              'Please place separate orders for different sellers.'
          )
        );
      }
      sellerId = product.seller.toString();

      // Buyer cannot order their own product
      if (sellerId === req.user._id.toString()) {
        await session.abortTransaction();
        return next(ApiError.badRequest('You cannot purchase your own products.'));
      }

      const qty = parseInt(item.quantity, 10) || 1;
      if (qty < 1 || qty > 10) {
        await session.abortTransaction();
        return next(ApiError.badRequest(`Quantity for "${product.title}" must be between 1 and 10.`));
      }

      if (product.stock < qty) {
        await session.abortTransaction();
        return next(
          ApiError.badRequest(
            `Insufficient stock for "${product.title}". Available: ${product.stock}, requested: ${qty}.`
          )
        );
      }

      // PRICE FROM DATABASE — not from the request
      const lineTotal = parseFloat((product.price * qty).toFixed(2));
      totalAmount += lineTotal;

      orderItems.push({
        product: product._id,
        title: product.title,
        price: product.price,   // snapshot at purchase time
        quantity: qty,
        image: product.images?.[0] || '',
      });
    }

    totalAmount = parseFloat(totalAmount.toFixed(2));

    // ── Atomically decrement stock ───────────────────────────────
    for (const item of orderItems) {
      const decremented = await Product.findOneAndUpdate(
        {
          _id: item.product,
          stock: { $gte: item.quantity },
          isActive: true,
          isBanned: false,
        },
        {
          $inc: { stock: -item.quantity },
          $set: { hasSold: true },
        },
        { new: true, session }
      );

      if (!decremented) {
        await session.abortTransaction();
        return next(
          ApiError.badRequest(
            `"${item.title}" just went out of stock. Please remove it and try again.`
          )
        );
      }

      if (decremented.stock === 0) {
        await Product.findByIdAndUpdate(
          item.product,
          { isActive: false },
          { session }
        );
      }
    }

    // ── Compute financials ────────────────────────────────────────
    const platformFee = parseFloat(((totalAmount * PLATFORM_FEE_PERCENT) / 100).toFixed(2));
    const sellerReceives = parseFloat((totalAmount - platformFee).toFixed(2));

    // ── Fetch buyer for name/address defaults ─────────────────────
    const buyer = await User.findById(req.user._id).session(session);

    // ── Create the order ──────────────────────────────────────────
    // KEY DIFFERENCE from placeOrder:
    //   - paymentMethod: 'sslcommerz'
    //   - paymentStatus: 'PENDING' (awaiting gateway payment)
    //   - escrowStatus: 'PENDING_PAYMENT' (no funds yet)
    const [order] = await Order.create(
      [
        {
          buyer: req.user._id,
          seller: sellerId,
          items: orderItems,
          totalAmount,
          platformFee,
          sellerReceives,
          paymentMethod: 'sslcommerz',
          paymentStatus: 'PENDING',
          escrowStatus: 'PENDING_PAYMENT',
          shippingAddress: {
            fullName: shippingAddress.fullName || buyer.name,
            address: shippingAddress.address,
            city: shippingAddress.city,
            district: shippingAddress.district || '',
            postalCode: shippingAddress.postalCode || '',
            phone: shippingAddress.phone,
          },
          escrowHistory: [
            {
              from: null,
              to: 'PENDING_PAYMENT',
              actor: req.user._id,
              actorRole: 'buyer',
              note: 'Order created — awaiting SSLCommerz payment.',
              timestamp: new Date(),
            },
          ],
        },
      ],
      { session }
    );

    // ── Commit ────────────────────────────────────────────────────
    // NOTE: No wallet deduction here. Funds are locked ONLY after
    // SSLCommerz IPN confirms payment in payment.controller.js.
    await session.commitTransaction();

    const populated = await populateOrder(Order.findById(order._id));

    return res.status(201).json({
      status: 'success',
      message: 'Order created. Proceed to payment.',
      data: {
        order: populated,
        nextStep: 'POST /api/payment/initiate with { orderId }',
      },
    });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

module.exports = {
  placeOrder,
  createOrder,
  getOrders,
  getSellerAnalytics,
  getOrder,
  markShipped,
  confirmDelivery,
  cancelOrder,
  downloadReceipt,
};
