const PaymentService = require('../services/payment.service');
const Order = require('../models/Order.model');
const env = require('../config/env');

/**
 * Payment Controller — Thin HTTP layer delegating to PaymentService.
 */

/**
 * POST /api/payment/initiate
 * Initiate SSLCommerz checkout session.
 */
const initiatePayment = async (req, res, next) => {
  try {
    const { orderId, callbackBaseUrl } = req.body;
    const data = await PaymentService.initiateGatewaySession({
      orderId,
      user: req.user,
      callbackBaseUrl,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Payment session created. Redirect buyer to the gateway.',
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payment/ipn
 * IPN Webhook from SSLCommerz.
 */
const handleIPN = async (req, res, next) => {
  try {
    const { val_id, tran_id } = req.body;
    const result = await PaymentService.processIpnWebhook({
      val_id,
      tran_id,
      reqMarkFailed: req._markIdempotencyFailed,
    });

    if (!result.success) {
      return res.status(200).json({
        status: 'fail',
        message: result.message,
      });
    }

    return res.status(200).json({
      status: 'success',
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payment/success
 * Browser redirect from SSLCommerz.
 */
const handleSuccess = async (req, res) => {
  try {
    const { value_a: orderId } = req.body;
    if (orderId) {
      return res.redirect(`${env.CLIENT_URL}/orders/${orderId}?payment=success`);
    }
    return res.redirect(`${env.CLIENT_URL}/orders?payment=success`);
  } catch (err) {
    console.error('[PaymentController] Success redirect error:', err.message);
    return res.redirect(`${env.CLIENT_URL}/orders?payment=success`);
  }
};

/**
 * POST /api/payment/fail
 * Browser redirect on failure.
 */
const handleFail = async (req, res) => {
  try {
    const { value_a: orderId, tran_id } = req.body;
    if (orderId) {
      await Order.findByIdAndUpdate(orderId, { paymentStatus: 'FAILED' });
      console.warn(`[PaymentController] Payment failed for order: ${orderId}, tran_id: ${tran_id}`);
      return res.redirect(`${env.CLIENT_URL}/orders/${orderId}?payment=failed`);
    }
    return res.redirect(`${env.CLIENT_URL}/orders?payment=failed`);
  } catch (err) {
    console.error('[PaymentController] Fail redirect error:', err.message);
    return res.redirect(`${env.CLIENT_URL}/orders?payment=failed`);
  }
};

/**
 * POST /api/payment/cancel
 * Browser redirect on cancellation.
 */
const handleCancel = async (req, res) => {
  try {
    const { value_a: orderId } = req.body;
    if (orderId) {
      return res.redirect(`${env.CLIENT_URL}/orders/${orderId}?payment=cancelled`);
    }
    return res.redirect(`${env.CLIENT_URL}/orders?payment=cancelled`);
  } catch (err) {
    console.error('[PaymentController] Cancel redirect error:', err.message);
    return res.redirect(`${env.CLIENT_URL}/orders?payment=cancelled`);
  }
};

module.exports = {
  initiatePayment,
  handleIPN,
  handleSuccess,
  handleFail,
  handleCancel,
};
