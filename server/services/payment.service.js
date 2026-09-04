const https = require('https');
const mongoose = require('mongoose');
const SSLCommerzPayment = require('sslcommerz-lts');
const Order = require('../models/Order.model');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const ApiError = require('../utils/apiError');
const env = require('../config/env');
const { sendOrderConfirmationEmail } = require('../utils/sendEmail');

const VALIDATION_URL_SANDBOX = 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
const VALIDATION_URL_LIVE = 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';

class PaymentService {
  /**
   * Server-to-server verification with SSLCommerz Validation API
   */
  static verifyPaymentWithSSLCommerz(valId) {
    return new Promise((resolve, reject) => {
      const baseUrl = env.SSLC.IS_SANDBOX ? VALIDATION_URL_SANDBOX : VALIDATION_URL_LIVE;
      const queryParams = new URLSearchParams({
        val_id: valId,
        store_id: env.SSLC.STORE_ID,
        store_passwd: env.SSLC.STORE_PASSWD,
        format: 'json',
      });

      const fullUrl = `${baseUrl}?${queryParams.toString()}`;

      const req = https.get(fullUrl, { timeout: 15000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (parseErr) {
            reject(new Error(`SSLCommerz validation response is not valid JSON: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`SSLCommerz validation network error: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('SSLCommerz validation request timed out (15s).'));
      });
    });
  }

  /**
   * Initiate SSLCommerz checkout session for an order
   */
  static async initiateGatewaySession({ orderId, user, callbackBaseUrl }) {
    if (!orderId) {
      throw ApiError.badRequest('orderId is required.');
    }

    const effectiveApiUrl = callbackBaseUrl || env.API_URL;
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order');
    }

    if (order.buyer.toString() !== user._id.toString()) {
      throw ApiError.forbidden('You can only pay for your own orders.');
    }

    if (order.paymentStatus !== 'PENDING') {
      throw ApiError.badRequest(
        `This order has already been ${order.paymentStatus.toLowerCase()}. Cannot re-initiate payment.`
      );
    }

    if (order.paymentMethod !== 'sslcommerz') {
      throw ApiError.badRequest('This order is not configured for SSLCommerz payment.');
    }

    const tran_id = `TTBD_${Date.now()}_${order._id.toString().slice(-8)}`;
    const buyer = await User.findById(order.buyer).select('name email phone');

    const sslData = {
      total_amount: order.totalAmount, // Server-side validated price
      currency: 'BDT',
      tran_id: tran_id,
      success_url: `${effectiveApiUrl}/api/payment/success`,
      fail_url: `${effectiveApiUrl}/api/payment/fail`,
      cancel_url: `${effectiveApiUrl}/api/payment/cancel`,
      ipn_url: `${effectiveApiUrl}/api/payment/ipn`,
      shipping_method: 'Courier',
      product_name: order.items.map((i) => i.title).join(', ').substring(0, 255),
      product_category: 'Marketplace',
      product_profile: 'physical-goods',
      cus_name: buyer?.name || 'TrustTrade Buyer',
      cus_email: buyer?.email || 'buyer@trusttrade.bd',
      cus_add1: order.shippingAddress?.address || 'Dhaka',
      cus_add2: order.shippingAddress?.district || 'Dhaka',
      cus_city: order.shippingAddress?.city || 'Dhaka',
      cus_state: order.shippingAddress?.district || 'Dhaka',
      cus_postcode: order.shippingAddress?.postalCode || '1000',
      cus_country: 'Bangladesh',
      cus_phone: order.shippingAddress?.phone || buyer?.phone || '01700000000',
      cus_fax: order.shippingAddress?.phone || '01700000000',
      ship_name: order.shippingAddress?.fullName || buyer?.name || 'Buyer',
      ship_add1: order.shippingAddress?.address || 'Dhaka',
      ship_add2: order.shippingAddress?.district || 'Dhaka',
      ship_city: order.shippingAddress?.city || 'Dhaka',
      ship_state: order.shippingAddress?.district || 'Dhaka',
      ship_postcode: order.shippingAddress?.postalCode || 1000,
      ship_country: 'Bangladesh',
      value_a: order._id.toString(),
      value_b: order.buyer.toString(),
      value_c: order.totalAmount.toString(),
      value_d: order.seller.toString(),
    };

    const sslcz = new SSLCommerzPayment(
      env.SSLC.STORE_ID,
      env.SSLC.STORE_PASSWD,
      !env.SSLC.IS_SANDBOX
    );
    const apiResponse = await sslcz.init(sslData);

    if (!apiResponse?.GatewayPageURL) {
      console.error('[PaymentService] SSLCommerz init failed:', apiResponse);
      throw ApiError.internal('Payment gateway initialisation failed. Please try again.');
    }

    order.sslcommerz = {
      ...order.sslcommerz,
      tran_id: tran_id,
    };
    await order.save();

    return {
      GatewayPageURL: apiResponse.GatewayPageURL,
      tran_id: tran_id,
    };
  }

  /**
   * Process IPN webhook with full server-side validation & ACID session
   */
  static async processIpnWebhook({ val_id, tran_id, reqMarkFailed }) {
    if (!val_id || !tran_id) {
      throw ApiError.badRequest('Missing val_id or tran_id.');
    }

    let validationResponse;
    try {
      validationResponse = await this.verifyPaymentWithSSLCommerz(val_id);
    } catch (networkErr) {
      if (reqMarkFailed) await reqMarkFailed();
      throw ApiError.internal('Payment validation temporarily unavailable. Will retry.');
    }

    const sslStatus = validationResponse.status;
    const sslAmount = parseFloat(validationResponse.amount);
    const sslCurrency = validationResponse.currency_type || validationResponse.currency;
    const sslTranId = validationResponse.tran_id;

    if (sslStatus !== 'VALID' && sslStatus !== 'VALIDATED') {
      if (reqMarkFailed) await reqMarkFailed();
      return { success: false, message: `Payment validation failed. Status: ${sslStatus}` };
    }

    const order = await Order.findOne({ 'sslcommerz.tran_id': sslTranId });
    if (!order) {
      return { success: false, message: 'Order not found for this transaction.' };
    }

    const expectedAmount = order.totalAmount;
    if (Math.abs(sslAmount - expectedAmount) > 0.01) {
      if (reqMarkFailed) await reqMarkFailed();
      return { success: false, message: 'Payment amount does not match order total.' };
    }

    if (sslCurrency && sslCurrency !== 'BDT') {
      if (reqMarkFailed) await reqMarkFailed();
      return { success: false, message: 'Currency mismatch.' };
    }

    if (order.paymentStatus === 'ESCROWED') {
      return { success: true, message: 'Payment already processed for this order.' };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const sessionOrder = await Order.findById(order._id).session(session);
      if (!sessionOrder) {
        throw new Error(`Order ${order._id} disappeared during transaction.`);
      }

      if (sessionOrder.paymentStatus !== 'PENDING') {
        await session.abortTransaction();
        return { success: true, message: 'Payment already processed (concurrent).' };
      }

      sessionOrder.transitionEscrow(
        'LOCKED',
        { _id: 'system', role: 'system' },
        `Payment verified via SSLCommerz (val_id: ${val_id}). Funds escrowed.`
      );

      sessionOrder.paymentStatus = 'ESCROWED';
      sessionOrder.sslcommerz = {
        tran_id: sslTranId,
        val_id: val_id,
        paidAt: new Date(),
      };

      await sessionOrder.save({ session });

      // Step 1: Record deposit into buyer wallet
      await Transaction.record(session, {
        userId: sessionOrder.buyer,
        type: 'DEPOSIT',
        amount: sessionOrder.totalAmount,
        walletField: 'balance',
        operation: 'increment',
        orderId: sessionOrder._id,
        initiatedBy: sessionOrder.buyer,
        description: `SSLCommerz payment received for order #${sessionOrder._id} (TXN: ${sslTranId})`,
      });

      // Step 2: Lock funds from balance into escrow
      await Transaction.record(session, {
        userId: sessionOrder.buyer,
        type: 'ORDER_LOCK',
        amount: sessionOrder.totalAmount,
        walletField: 'balance',
        operation: 'decrement',
        orderId: sessionOrder._id,
        initiatedBy: sessionOrder.buyer,
        description: `Funds locked in escrow for order #${sessionOrder._id}`,
      });

      await Transaction.record(session, {
        userId: sessionOrder.buyer,
        type: 'ORDER_LOCK',
        amount: sessionOrder.totalAmount,
        walletField: 'escrowBalance',
        operation: 'increment',
        orderId: sessionOrder._id,
        initiatedBy: sessionOrder.buyer,
        description: `Escrow hold placed for order #${sessionOrder._id}`,
      });

      await session.commitTransaction();

      // Async email
      Order.findById(sessionOrder._id)
        .populate('buyer', 'name email')
        .populate('items.product', 'title')
        .then((populated) => {
          if (populated?.buyer?.email) {
            const orderUrl = `${env.CLIENT_URL}/orders/${sessionOrder._id}`;
            sendOrderConfirmationEmail(populated.buyer.email, populated.buyer.name, populated, orderUrl).catch(
              (err) => console.error('[PaymentService] Email send error:', err)
            );
          }
        })
        .catch((err) => console.error('[PaymentService] Populate order error:', err));

      return { success: true, message: 'Payment verified and funds escrowed.' };
    } catch (txErr) {
      await session.abortTransaction();
      if (reqMarkFailed) await reqMarkFailed();
      throw ApiError.internal(`Payment processing failed: ${txErr.message}`);
    } finally {
      session.endSession();
    }
  }
}

module.exports = PaymentService;
