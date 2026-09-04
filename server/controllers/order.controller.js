const OrderService = require('../services/order.service');
const Order = require('../models/Order.model');
const ApiError = require('../utils/apiError');
const { generateReceiptPdf } = require('../utils/generateReceiptPdf');

/**
 * Order Controller — Slim HTTP transport layer delegating to OrderService.
 */

/**
 * POST /api/orders
 * Buyer only — place order paid via Wallet with instant escrow lock.
 */
const placeOrder = async (req, res, next) => {
  try {
    const order = await OrderService.placeWalletOrder({
      buyerUser: req.user,
      items: req.body.items,
      shippingAddress: req.body.shippingAddress,
      clientOrigin: req.headers.origin,
    });

    return res.status(201).json({
      status: 'success',
      message: 'Order placed successfully. Funds are held in escrow.',
      data: { order },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/create-for-payment
 * Buyer only — create order awaiting SSLCommerz gateway payment.
 */
const createOrder = async (req, res, next) => {
  try {
    const order = await OrderService.createPaymentOrder({
      buyerUser: req.user,
      items: req.body.items,
      shippingAddress: req.body.shippingAddress,
    });

    return res.status(201).json({
      status: 'success',
      message: 'Order created. Proceed to payment.',
      data: {
        order,
        nextStep: 'POST /api/payment/initiate with { orderId }',
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders
 * Paginated order list for current buyer or seller.
 */
const getOrders = async (req, res, next) => {
  try {
    const result = await OrderService.getOrders({
      user: req.user,
      query: req.query,
    });

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/seller/analytics
 * Seller only — aggregate sales & revenue stats.
 */
const getSellerAnalytics = async (req, res, next) => {
  try {
    const data = await OrderService.getSellerAnalytics(req.user._id);
    return res.status(200).json({
      status: 'success',
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/:id
 * Get single order details with ownership validation.
 */
const getOrder = async (req, res, next) => {
  try {
    const order = await OrderService.getOrderById(req.params.id, req.user);
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
 */
const markShipped = async (req, res, next) => {
  try {
    const order = await OrderService.markOrderShipped({
      orderId: req.params.id,
      sellerUser: req.user,
      note: req.body.note,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Order marked as shipped. Awaiting buyer confirmation.',
      data: { order },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/confirm-delivery
 * Buyer only — confirm delivery and release funds to seller.
 */
const confirmDelivery = async (req, res, next) => {
  try {
    const { order, sellerReceives } = await OrderService.confirmOrderDelivery({
      orderId: req.params.id,
      buyerUser: req.user,
    });

    return res.status(200).json({
      status: 'success',
      message: `Delivery confirmed. ৳${sellerReceives} released to seller.`,
      data: { order },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/cancel
 * Buyer only — cancel locked order and trigger instant refund.
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { order, refundedAmount } = await OrderService.cancelOrder({
      orderId: req.params.id,
      buyerUser: req.user,
    });

    return res.status(200).json({
      status: 'success',
      message: `Order cancelled. ৳${refundedAmount} refunded to your wallet.`,
      data: { order },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/:id/receipt
 * Download PDF receipt.
 */
const downloadReceipt = async (req, res, next) => {
  try {
    const order = await OrderService.getOrderById(req.params.id, req.user);
    const pdfBuffer = await generateReceiptPdf(order.toObject());
    const filename = `TrustTrade-Receipt-${order._id.toString().slice(-8).toUpperCase()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    if (err.isOperational) return next(err);
    console.error('PDF generation error:', err);
    next(ApiError.internal('Failed to generate receipt. Please try again.'));
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
