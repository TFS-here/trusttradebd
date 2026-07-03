const mongoose = require('mongoose');
const https = require('https');
const SSLCommerzPayment = require('sslcommerz-lts');
const Order = require('../models/Order.model');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const ApiError = require('../utils/apiError');

// ── SSLCommerz configuration ──────────────────────────────────────
const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWD;
const is_live = process.env.SSLC_IS_SANDBOX !== 'true';

const API_URL = process.env.API_URL || 'http://localhost:5000';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// SSLCommerz Validation API endpoints
const VALIDATION_URL_SANDBOX = 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
const VALIDATION_URL_LIVE = 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Makes a server-to-server HTTPS GET request to SSLCommerz's
 * Validation API to verify a payment via its `val_id`.
 *
 * WHY NOT use the sslcommerz-lts SDK for validation?
 * The SDK's `validate()` method uses the same approach internally,
 * but we do it manually for full control over:
 *   - Timeout handling
 *   - Response parsing
 *   - Error classification
 *   - Audit logging
 *
 * @param {string} valId  The `val_id` from the IPN/success callback
 * @returns {Promise<Object>}  Parsed JSON response from SSLCommerz
 */
function verifyPaymentWithSSLCommerz(valId) {
  return new Promise((resolve, reject) => {
    const baseUrl = is_live ? VALIDATION_URL_LIVE : VALIDATION_URL_SANDBOX;
    const queryParams = new URLSearchParams({
      val_id: valId,
      store_id: store_id,
      store_passwd: store_passwd,
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

// ── Controllers ───────────────────────────────────────────────────

/**
 * POST /api/payment/initiate
 * ────────────────────────────────────────────────────────────────
 * SECURITY STANDARD #1: SERVER-SIDE PRICE VALIDATION
 *
 * The frontend sends ONLY the `orderId`. The server fetches the
 * verified product price from MongoDB and uses THAT to initialise
 * the SSLCommerz session. The frontend never touches the amount.
 *
 * Pre-conditions:
 *   - Order must exist, belong to req.user, and be in PENDING_PAYMENT state
 *   - Order must have paymentMethod === 'sslcommerz'
 *
 * Returns: { GatewayPageURL } for the frontend to redirect the buyer
 */
const initiatePayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return next(ApiError.badRequest('orderId is required.'));
    }

    // ── Fetch order and validate ownership ──────────────────────
    const order = await Order.findById(orderId);
    if (!order) {
      return next(ApiError.notFound('Order'));
    }

    // Only the buyer who created the order can pay for it
    if (order.buyer.toString() !== req.user._id.toString()) {
      return next(ApiError.forbidden('You can only pay for your own orders.'));
    }

    // Only PENDING_PAYMENT orders can be initiated
    if (order.paymentStatus !== 'PENDING') {
      return next(
        ApiError.badRequest(
          `This order has already been ${order.paymentStatus.toLowerCase()}. Cannot re-initiate payment.`
        )
      );
    }

    if (order.paymentMethod !== 'sslcommerz') {
      return next(
        ApiError.badRequest('This order is not configured for SSLCommerz payment.')
      );
    }

    // ── Generate a unique transaction ID ────────────────────────
    // Format: TTBD_<timestamp>_<orderId_last8>
    const tran_id = `TTBD_${Date.now()}_${order._id.toString().slice(-8)}`;

    // ── Fetch buyer details for SSLCommerz ──────────────────────
    const buyer = await User.findById(order.buyer).select('name email phone');

    // ── Build SSLCommerz payload ────────────────────────────────
    // CRITICAL: total_amount comes from the ORDER IN THE DATABASE,
    // not from the request body. This prevents price tampering.
    const sslData = {
      total_amount: order.totalAmount,    // ← SERVER-SIDE PRICE
      currency: 'BDT',
      tran_id: tran_id,

      // Callback URLs — SSLCommerz POSTs to these
      success_url: `${API_URL}/api/payment/success`,
      fail_url: `${API_URL}/api/payment/fail`,
      cancel_url: `${API_URL}/api/payment/cancel`,
      ipn_url: `${API_URL}/api/payment/ipn`,

      // Product info
      shipping_method: 'Courier',
      product_name: order.items.map((i) => i.title).join(', ').substring(0, 255),
      product_category: 'Marketplace',
      product_profile: 'physical-goods',

      // Customer info (from DB, not from request)
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

      // Shipping info
      ship_name: order.shippingAddress?.fullName || buyer?.name || 'Buyer',
      ship_add1: order.shippingAddress?.address || 'Dhaka',
      ship_add2: order.shippingAddress?.district || 'Dhaka',
      ship_city: order.shippingAddress?.city || 'Dhaka',
      ship_state: order.shippingAddress?.district || 'Dhaka',
      ship_postcode: order.shippingAddress?.postalCode || 1000,
      ship_country: 'Bangladesh',

      // Custom value fields — pass IDs for callback identification
      // These come back in the IPN/success payload
      value_a: order._id.toString(),          // Order ID
      value_b: order.buyer.toString(),         // Buyer ID
      value_c: order.totalAmount.toString(),   // Amount for cross-check
      value_d: order.seller.toString(),        // Seller ID
    };

    // ── Initialise SSLCommerz session ───────────────────────────
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const apiResponse = await sslcz.init(sslData);

    if (!apiResponse?.GatewayPageURL) {
      console.error('[Payment] SSLCommerz init failed:', apiResponse);
      return next(ApiError.internal('Payment gateway initialisation failed. Please try again.'));
    }

    // ── Store tran_id on the order for later verification ───────
    order.sslcommerz = {
      ...order.sslcommerz,
      tran_id: tran_id,
    };
    await order.save();

    return res.status(200).json({
      status: 'success',
      message: 'Payment session created. Redirect buyer to the gateway.',
      data: {
        GatewayPageURL: apiResponse.GatewayPageURL,
        tran_id: tran_id,
      },
    });
  } catch (err) {
    console.error('[Payment] initiatePayment error:', err);
    next(err);
  }
};

/**
 * POST /api/payment/ipn
 * ────────────────────────────────────────────────────────────────
 * SECURITY STANDARD #2: SECURE WEBHOOK / IPN VALIDATION
 * SECURITY STANDARD #3: MONGOOSE ACID TRANSACTIONS
 *
 * This is the most security-critical route in the entire system.
 * SSLCommerz fires this webhook after a successful payment.
 *
 * Trust model: We do NOT trust the incoming request body at all.
 * Instead, we:
 *   1. Extract only the `val_id` from the payload
 *   2. Make a server-to-server HTTPS GET to SSLCommerz Validation API
 *   3. Cross-check: status === 'VALID', amount matches DB, currency is BDT
 *   4. Only THEN update the order + escrow inside a MongoDB ACID transaction
 *
 * Idempotency: The `idempotencyGuardByField('ipn', 'tran_id')`
 * middleware (applied at the route level) ensures duplicate IPN
 * fires are safely ignored.
 */
const handleIPN = async (req, res, next) => {
  // ── Step 1: Extract val_id — the ONLY thing we use from the body
  const { val_id, tran_id } = req.body;

  if (!val_id) {
    console.warn('[IPN] Received IPN without val_id. Body:', JSON.stringify(req.body).substring(0, 500));
    return res.status(400).json({ status: 'fail', message: 'Missing val_id.' });
  }

  if (!tran_id) {
    console.warn('[IPN] Received IPN without tran_id.');
    return res.status(400).json({ status: 'fail', message: 'Missing tran_id.' });
  }

  // ── Step 2: Server-to-server validation with SSLCommerz ──────
  let validationResponse;
  try {
    validationResponse = await verifyPaymentWithSSLCommerz(val_id);
  } catch (networkErr) {
    // Network drop or timeout — log and respond 500 so SSLCommerz retries
    console.error('[IPN] SSLCommerz validation network error:', networkErr.message);

    // Mark idempotency as failed so the retry is allowed
    if (req._markIdempotencyFailed) await req._markIdempotencyFailed();

    return res.status(500).json({
      status: 'error',
      message: 'Payment validation temporarily unavailable. Will retry.',
    });
  }

  // ── Step 3: Validate the response from SSLCommerz ────────────
  const sslStatus = validationResponse.status;
  const sslAmount = parseFloat(validationResponse.amount);
  const sslCurrency = validationResponse.currency_type || validationResponse.currency;
  const sslTranId = validationResponse.tran_id;

  // Status must be VALID or VALIDATED
  if (sslStatus !== 'VALID' && sslStatus !== 'VALIDATED') {
    console.warn(`[IPN] Payment not valid. Status: ${sslStatus}, tran_id: ${tran_id}`);

    // Mark idempotency as failed to allow future retries
    if (req._markIdempotencyFailed) await req._markIdempotencyFailed();

    return res.status(200).json({
      status: 'fail',
      message: `Payment validation failed. SSLCommerz status: ${sslStatus}`,
    });
  }

  // ── Step 4: Find the order and cross-check ───────────────────
  const order = await Order.findOne({ 'sslcommerz.tran_id': sslTranId });
  if (!order) {
    console.error(`[IPN] No order found for tran_id: ${sslTranId}`);
    return res.status(200).json({ status: 'fail', message: 'Order not found for this transaction.' });
  }

  // ── CRITICAL: Cross-check the amount ─────────────────────────
  // The amount returned by SSLCommerz's Validation API must match
  // what we stored in the order. This prevents:
  //   - Partial payment attacks (pay ৳1 for a ৳10,000 item)
  //   - Amount tampering at the gateway level
  const expectedAmount = order.totalAmount;
  if (Math.abs(sslAmount - expectedAmount) > 0.01) {
    console.error(
      `[IPN] AMOUNT MISMATCH! Expected: ${expectedAmount}, Got: ${sslAmount}, ` +
      `tran_id: ${sslTranId}, orderId: ${order._id}`
    );

    // Mark idempotency as failed
    if (req._markIdempotencyFailed) await req._markIdempotencyFailed();

    return res.status(200).json({
      status: 'fail',
      message: 'Payment amount does not match order total.',
    });
  }

  // Currency must be BDT
  if (sslCurrency && sslCurrency !== 'BDT') {
    console.error(`[IPN] Currency mismatch. Expected: BDT, Got: ${sslCurrency}`);
    if (req._markIdempotencyFailed) await req._markIdempotencyFailed();
    return res.status(200).json({ status: 'fail', message: 'Currency mismatch.' });
  }

  // ── Already processed? (Belt-and-suspenders with idempotency) ─
  if (order.paymentStatus === 'ESCROWED') {
    return res.status(200).json({
      status: 'success',
      message: 'Payment already processed for this order.',
    });
  }

  // ── Step 5: ACID Transaction — atomic state update ───────────
  // SECURITY STANDARD #3: All mutations in a single transaction.
  // If ANY step fails, everything rolls back.
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 5a. Reload order inside session for consistency
    const sessionOrder = await Order.findById(order._id).session(session);
    if (!sessionOrder) {
      throw new Error(`Order ${order._id} disappeared during transaction.`);
    }

    // 5b. Verify order is still in PENDING state (race condition guard)
    if (sessionOrder.paymentStatus !== 'PENDING') {
      // Another IPN already processed this — safe to return success
      await session.abortTransaction();
      return res.status(200).json({
        status: 'success',
        message: 'Payment already processed (concurrent).',
      });
    }

    // 5c. Transition escrow state: PENDING_PAYMENT → LOCKED
    sessionOrder.transitionEscrow('LOCKED', { _id: 'system', role: 'system' },
      `Payment verified via SSLCommerz (val_id: ${val_id}). Funds escrowed.`
    );

    // 5d. Update payment status and SSLCommerz metadata
    sessionOrder.paymentStatus = 'ESCROWED';
    sessionOrder.sslcommerz = {
      tran_id: sslTranId,
      val_id: val_id,
      paidAt: new Date(),
    };

    await sessionOrder.save({ session });

    // 5e. Record the escrow hold in the financial ledger
    //     This creates Transaction documents that track the money flow.
    //     For SSLCommerz payments, we record the incoming funds as a
    //     deposit to the buyer, then immediately lock them in escrow.
    //
    //     Step 1: Credit buyer wallet (money received from gateway)
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

    //     Step 2: Lock funds in escrow (deduct from spendable balance)
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

    //     Step 3: Track escrow hold
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

    // ── Commit the entire transaction ──────────────────────────
    await session.commitTransaction();

    // Send confirmation email asynchronously
    try {
      const populated = await Order.findById(sessionOrder._id)
        .populate('buyer', 'name email')
        .populate('items.product', 'title');
      
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const orderUrl = `${frontendUrl}/orders/${sessionOrder._id}`;
      
      const { sendOrderConfirmationEmail } = require('../utils/sendEmail');
      sendOrderConfirmationEmail(populated.buyer.email, populated.buyer.name, populated, orderUrl).catch(err => 
        console.error('Failed to send order confirmation email:', err)
      );
    } catch (emailErr) {
      console.error('[IPN] Email send error:', emailErr);
    }

    console.log(
      `[IPN] ✅ Payment verified & escrowed. Order: ${sessionOrder._id}, ` +
      `Amount: ৳${sessionOrder.totalAmount}, TXN: ${sslTranId}`
    );

    return res.status(200).json({
      status: 'success',
      message: 'Payment verified and funds escrowed.',
    });
  } catch (txErr) {
    // ── ROLLBACK on any failure ────────────────────────────────
    await session.abortTransaction();
    console.error('[IPN] Transaction failed — rolled back:', txErr.message);

    // Mark idempotency as failed so SSLCommerz can retry
    if (req._markIdempotencyFailed) await req._markIdempotencyFailed();

    return res.status(500).json({
      status: 'error',
      message: 'Payment processing failed. Will retry on next IPN.',
    });
  } finally {
    session.endSession();
  }
};

/**
 * POST /api/payment/success
 * ────────────────────────────────────────────────────────────────
 * Browser redirect callback from SSLCommerz after successful payment.
 * This is NOT the source of truth — the IPN handler is.
 * This route simply redirects the buyer back to the frontend.
 */
const handleSuccess = async (req, res) => {
  try {
    const { value_a: orderId } = req.body;

    if (orderId) {
      return res.redirect(`${CLIENT_URL}/orders/${orderId}?payment=success`);
    }

    return res.redirect(`${CLIENT_URL}/orders?payment=success`);
  } catch (err) {
    console.error('[Payment] Success callback error:', err.message);
    return res.redirect(`${CLIENT_URL}/orders?payment=success`);
  }
};

/**
 * POST /api/payment/fail
 * ────────────────────────────────────────────────────────────────
 * Browser redirect on payment failure. Marks order as failed.
 */
const handleFail = async (req, res) => {
  try {
    const { value_a: orderId, tran_id } = req.body;

    if (orderId) {
      // Mark payment as failed (non-transactional — this is just a status flag)
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'FAILED',
      });

      console.warn(`[Payment] Payment failed. Order: ${orderId}, tran_id: ${tran_id}`);
      return res.redirect(`${CLIENT_URL}/orders/${orderId}?payment=failed`);
    }

    return res.redirect(`${CLIENT_URL}/orders?payment=failed`);
  } catch (err) {
    console.error('[Payment] Fail callback error:', err.message);
    return res.redirect(`${CLIENT_URL}/orders?payment=failed`);
  }
};

/**
 * POST /api/payment/cancel
 * ────────────────────────────────────────────────────────────────
 * Browser redirect when user cancels payment at the gateway.
 */
const handleCancel = async (req, res) => {
  try {
    const { value_a: orderId } = req.body;

    if (orderId) {
      console.info(`[Payment] Payment cancelled by user. Order: ${orderId}`);
      return res.redirect(`${CLIENT_URL}/orders/${orderId}?payment=cancelled`);
    }

    return res.redirect(`${CLIENT_URL}/orders?payment=cancelled`);
  } catch (err) {
    console.error('[Payment] Cancel callback error:', err.message);
    return res.redirect(`${CLIENT_URL}/orders?payment=cancelled`);
  }
};

module.exports = {
  initiatePayment,
  handleIPN,
  handleSuccess,
  handleFail,
  handleCancel,
};
