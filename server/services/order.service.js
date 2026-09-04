const mongoose = require('mongoose');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const User = require('../models/User.model');
const { lockFunds, releaseFunds, refundFunds, getPlatformFeePercent } = require('../utils/escrow');
const ApiError = require('../utils/apiError');
const { sendOrderConfirmationEmail } = require('../utils/sendEmail');
const pathaoService = require('./pathao.service');
const env = require('../config/env');

/**
 * Shape an order for API responses — populate refs cleanly.
 */
const populateOrder = (query) =>
  query
    .populate('buyer', 'name email avatar')
    .populate('seller', 'name email avatar sellerProfile.shopName')
    .populate('items.product', 'title images category');

/**
 * Validate order items, verify stock availability, ensure single-seller constraint,
 * and calculate order totals with database-verified prices.
 */
const validateAndPrepareItems = async (items, buyerId, session) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Order must contain at least one item.');
  }

  const productIds = items.map((i) => i.productId);
  const products = await Product.find({
    _id: { $in: productIds },
    isActive: true,
    isBanned: false,
  }).session(session);

  if (products.length !== productIds.length) {
    throw ApiError.badRequest('One or more products are unavailable or do not exist.');
  }

  const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));
  const orderItems = [];
  let totalAmount = 0;
  let sellerId = null;

  for (const item of items) {
    const product = productMap[item.productId];
    if (!product) {
      throw ApiError.badRequest(`Product ${item.productId} not found.`);
    }

    if (sellerId && product.seller.toString() !== sellerId) {
      throw ApiError.badRequest(
        'All items in one order must be from the same seller. Please place separate orders for different sellers.'
      );
    }
    sellerId = product.seller.toString();

    if (sellerId === buyerId.toString()) {
      throw ApiError.badRequest('You cannot purchase your own products.');
    }

    const qty = parseInt(item.quantity, 10) || 1;
    if (qty < 1 || qty > 10) {
      throw ApiError.badRequest(`Quantity for "${product.title}" must be between 1 and 10.`);
    }

    if (product.stock < qty) {
      throw ApiError.badRequest(
        `Insufficient stock for "${product.title}". Available: ${product.stock}, requested: ${qty}.`
      );
    }

    const lineTotal = parseFloat((product.price * qty).toFixed(2));
    totalAmount += lineTotal;

    orderItems.push({
      product: product._id,
      title: product.title,
      price: product.price,
      quantity: qty,
      image: product.images?.[0] || '',
    });
  }

  totalAmount = parseFloat(totalAmount.toFixed(2));
  return { orderItems, totalAmount, sellerId };
};

/**
 * Decrements stock atomically within a session.
 */
const reserveStock = async (orderItems, session) => {
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
      throw ApiError.badRequest(`"${item.title}" just went out of stock. Please remove it and try again.`);
    }

    if (decremented.stock === 0) {
      await Product.findByIdAndUpdate(item.product, { isActive: false }, { session });
    }
  }
};

/**
 * Order Service
 */
class OrderService {
  /**
   * Place an order paid directly from Buyer Wallet (Escrow LOCKED immediately)
   */
  static async placeWalletOrder({ buyerUser, items, shippingAddress, clientOrigin }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!shippingAddress?.address || !shippingAddress?.city || !shippingAddress?.phone) {
        throw ApiError.badRequest('Shipping address (address, city, phone) is required.');
      }

      const { orderItems, totalAmount, sellerId } = await validateAndPrepareItems(
        items,
        buyerUser._id,
        session
      );

      // Check buyer balance
      const buyer = await User.findById(buyerUser._id).session(session);
      const available = parseFloat((buyer.wallet.balance - buyer.wallet.escrowBalance).toFixed(2));

      if (available < totalAmount) {
        throw ApiError.badRequest(
          `Insufficient wallet balance. Required: ৳${totalAmount}, Available: ৳${available}. Please top up your wallet.`
        );
      }

      // Reserve stock
      await reserveStock(orderItems, session);

      // Escrow fee calculation
      const percent = await getPlatformFeePercent();
      const platformFee = parseFloat(((totalAmount * percent) / 100).toFixed(2));
      const sellerReceives = parseFloat((totalAmount - platformFee).toFixed(2));

      // Create order
      const [order] = await Order.create(
        [
          {
            buyer: buyerUser._id,
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
                actor: buyerUser._id,
                actorRole: 'buyer',
                note: 'Order placed — funds locked in escrow.',
                timestamp: new Date(),
              },
            ],
          },
        ],
        { session }
      );

      // Lock funds in escrow
      await lockFunds(session, {
        buyerId: buyerUser._id,
        amount: totalAmount,
        orderId: order._id,
      });

      await session.commitTransaction();

      const populated = await populateOrder(Order.findById(order._id));

      // Asynchronous email notification
      const frontendUrl = clientOrigin || env.CLIENT_URL;
      const orderUrl = `${frontendUrl}/orders/${order._id}`;
      sendOrderConfirmationEmail(buyer.email, buyer.name, populated, orderUrl).catch((err) =>
        console.error('Failed to send order confirmation email:', err)
      );

      return populated;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Create an order awaiting Gateway payment (SSLCommerz)
   */
  static async createPaymentOrder({ buyerUser, items, shippingAddress }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!shippingAddress?.address || !shippingAddress?.city || !shippingAddress?.phone) {
        throw ApiError.badRequest('Shipping address (address, city, phone) is required.');
      }

      const { orderItems, totalAmount, sellerId } = await validateAndPrepareItems(
        items,
        buyerUser._id,
        session
      );

      // Reserve stock
      await reserveStock(orderItems, session);

      // Compute financials
      const percent = await getPlatformFeePercent();
      const platformFee = parseFloat(((totalAmount * percent) / 100).toFixed(2));
      const sellerReceives = parseFloat((totalAmount - platformFee).toFixed(2));

      const buyer = await User.findById(buyerUser._id).session(session);

      const [order] = await Order.create(
        [
          {
            buyer: buyerUser._id,
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
                actor: buyerUser._id,
                actorRole: 'buyer',
                note: 'Order created — awaiting SSLCommerz payment.',
                timestamp: new Date(),
              },
            ],
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return await populateOrder(Order.findById(order._id));
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Mark order as shipped
   */
  static async markOrderShipped({ orderId, sellerUser, note }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw ApiError.notFound('Order');

      if (order.seller.toString() !== sellerUser._id.toString()) {
        throw ApiError.forbidden('Only the seller can mark an order as shipped.');
      }

      order.transitionEscrow('SHIPPED', sellerUser, note || 'Order shipped via Pathao Sandbox.');

      const sellerDoc = await mongoose.model('User').findById(order.seller).session(session);
      try {
        const consignmentId = await pathaoService.createConsignment(order, sellerDoc);
        order.trackingNumber = consignmentId;
      } catch (pathaoErr) {
        throw ApiError.badRequest(`Pathao Courier Error: ${pathaoErr.message}`);
      }

      await order.save({ session });
      await session.commitTransaction();

      return await populateOrder(Order.findById(order._id));
    } catch (err) {
      await session.abortTransaction();
      if (!err.isOperational) throw ApiError.badRequest(err.message);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Confirm delivery and release funds to seller
   */
  static async confirmOrderDelivery({ orderId, buyerUser }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw ApiError.notFound('Order');

      if (order.buyer.toString() !== buyerUser._id.toString()) {
        throw ApiError.forbidden('Only the buyer can confirm delivery.');
      }

      order.transitionEscrow('DELIVERED', buyerUser, 'Buyer confirmed receipt.');
      order.transitionEscrow('RELEASED', buyerUser, 'Funds released to seller automatically on delivery confirmation.');

      const { sellerReceives, platformFee } = await releaseFunds(session, {
        buyerId: order.buyer,
        sellerId: order.seller,
        amount: order.totalAmount,
        orderId: order._id,
        initiatedBy: buyerUser._id,
      });

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
      return { order: populated, sellerReceives };
    } catch (err) {
      await session.abortTransaction();
      if (!err.isOperational) throw ApiError.badRequest(err.message);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancel order and refund buyer (LOCKED state only)
   */
  static async cancelOrder({ orderId, buyerUser }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw ApiError.notFound('Order');

      if (order.buyer.toString() !== buyerUser._id.toString()) {
        throw ApiError.forbidden('Only the buyer can cancel their order.');
      }

      if (order.escrowStatus !== 'LOCKED') {
        throw ApiError.badRequest(
          `Cannot cancel an order that is already ${order.escrowStatus}. Contact support to raise a dispute.`
        );
      }

      order.transitionEscrow('REFUNDED', buyerUser, 'Full refund issued — order cancelled before shipment.');

      await refundFunds(session, {
        buyerId: order.buyer,
        amount: order.totalAmount,
        orderId: order._id,
        initiatedBy: buyerUser._id,
      });

      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          {
            $inc: { stock: item.quantity },
            $set: { isActive: true },
          },
          { session }
        );
      }

      await order.save({ session });
      await session.commitTransaction();

      const populated = await populateOrder(Order.findById(order._id));
      return { order: populated, refundedAmount: order.totalAmount };
    } catch (err) {
      await session.abortTransaction();
      if (!err.isOperational) throw ApiError.badRequest(err.message);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Query orders with pagination and role filters
   */
  static async getOrders({ user, query }) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, parseInt(query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const filter = {};
    if (user.role === 'buyer') filter.buyer = user._id;
    else if (user.role === 'seller') filter.seller = user._id;

    if (query.status) filter.escrowStatus = query.status.toUpperCase();

    const [orders, total] = await Promise.all([
      populateOrder(Order.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);

    return {
      orders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Aggregate seller dashboard analytics
   */
  static async getSellerAnalytics(sellerId) {
    const stats = await Order.aggregate([
      { $match: { seller: new mongoose.Types.ObjectId(sellerId) } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$escrowStatus', 'RELEASED'] }, 1, 0] },
          },
          pendingOrders: {
            $sum: { $cond: [{ $in: ['$escrowStatus', ['LOCKED', 'SHIPPED', 'ON_HOLD']] }, 1, 0] },
          },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ['$escrowStatus', 'RELEASED'] }, '$sellerReceives', 0] },
          },
        },
      },
    ]);

    const analytics = stats[0] || {
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      totalRevenue: 0,
    };

    const recentOrders = await Order.find({ seller: sellerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('buyer', 'name email avatar')
      .populate('items.product', 'title images');

    return { analytics, recentOrders };
  }

  /**
   * Get single order by ID with authorization check
   */
  static async getOrderById(orderId, user) {
    const order = await populateOrder(Order.findById(orderId));
    if (!order) throw ApiError.notFound('Order');

    const isBuyer = order.buyer._id.toString() === user._id.toString();
    const isSeller = order.seller._id.toString() === user._id.toString();
    const isAdmin = user.role === 'admin';

    if (!isBuyer && !isSeller && !isAdmin) {
      throw ApiError.forbidden('You do not have access to this order.');
    }

    return order;
  }
}

module.exports = OrderService;
