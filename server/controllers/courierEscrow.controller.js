const mongoose = require('mongoose');
const Order = require('../models/Order.model');
const { releaseFunds } = require('../utils/escrow');
const ApiError = require('../utils/apiError');
const cron = require('node-cron');

// ── Pathao status → human label map ──────────────────────────────
const PATHAO_STATUS_LABELS = {
  Pickup_Requested: 'Pickup Requested',
  On_The_Way:       'In Transit',
  Delivered:        'Delivered',
  Partial_Delivery: 'Partial Delivery',
  Return_In_Transit: 'Returning',
  Returned:         'Returned to Seller',
  // Sandbox aliases
  pickup_requested: 'Pickup Requested',
  on_the_way:       'In Transit',
  delivered:        'Delivered',
};

/**
 * Pathao Webhook Handler
 * ─────────────────────────────────────────────────────────────────
 * Handles ALL Pathao status events — not just "Delivered".
 * Saves every event to courierStatusHistory for live tracking.
 * Only triggers DELIVERED escrow transition when status === 'Delivered'.
 */
exports.pathaoWebhook = async (req, res, next) => {
  try {
    const expectedSecret = process.env.PATHAO_WEBHOOK_SECRET;

    // ── Integration Handshake ─────────────────────────────────────
    if (req.body.event === 'webhook_integration') {
      res.setHeader('X-Pathao-Merchant-Webhook-Integration-Secret', expectedSecret || '');
      return res.status(202).json({ received: true });
    }

    // ── Verify secret ─────────────────────────────────────────────
    const secret = req.headers['x-pathao-secret'] || req.headers['authorization'];
    if (expectedSecret && secret !== expectedSecret) {
      console.warn('⚠️  Pathao webhook received with invalid secret.');
      return res.status(200).json({ received: true }); // ACK but ignore
    }

    const { consignment_id, status } = req.body;
    const normalizedStatus = status ? status.trim() : '';

    if (!consignment_id || !normalizedStatus) {
      return res.status(200).json({ received: true }); // Malformed — ACK and ignore
    }

    // Find order by tracking number
    const order = await Order.findOne({ trackingNumber: consignment_id });
    if (!order) {
      console.warn(`⚠️  Pathao webhook: no order found for consignment_id=${consignment_id}`);
      return res.status(200).json({ received: true });
    }

    // ── Save courier status to timeline ───────────────────────────
    const label = PATHAO_STATUS_LABELS[normalizedStatus] || normalizedStatus;
    order.courierStatus = label;
    order.courierStatusHistory.push({ status: label, timestamp: new Date() });

    // ── Handle Delivered ──────────────────────────────────────────
    const isDelivered = ['delivered', 'Delivered'].includes(normalizedStatus);
    if (isDelivered && order.escrowStatus === 'SHIPPED') {
      const releaseDate = new Date();
      releaseDate.setHours(releaseDate.getHours() + 24); // 24-hour buyer inspection window

      const systemActor = { _id: null, role: 'system' };
      order.transitionEscrow('DELIVERED', systemActor, 'Pathao Webhook: Item Delivered.');
      order.escrowReleaseDate = releaseDate;
      console.log(`✅ Order ${order._id} marked DELIVERED. Escrow auto-releases at ${releaseDate}`);
    }

    await order.save();
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Pathao webhook error:', error.message);
    return res.status(200).json({ received: true }); // Always ACK to Pathao
  }
};

/**
 * Escrow Auto-Release Cron Job
 * ─────────────────────────────────────────────────────────────────
 * Runs every hour.
 * Releases funds for DELIVERED orders past their 24h window.
 */
const startEscrowReleaseCron = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('⏳ [Cron] Running Escrow Auto-Release...');
    try {
      const now = new Date();
      const pendingReleaseOrders = await Order.find({
        escrowStatus: 'DELIVERED',
        escrowReleaseDate: { $lte: now },
      });

      console.log(`[Cron] ${pendingReleaseOrders.length} order(s) eligible for auto-release.`);

      for (const order of pendingReleaseOrders) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const lockedOrder = await Order.findById(order._id).session(session);
          const { sellerReceives, platformFee } = await releaseFunds(session, {
            buyerId:     lockedOrder.buyer,
            sellerId:    lockedOrder.seller,
            amount:      lockedOrder.totalAmount,
            orderId:     lockedOrder._id,
            initiatedBy: null,
          });

          lockedOrder.sellerReceives = sellerReceives;
          lockedOrder.platformFee    = platformFee;

          const systemActor = { _id: null, role: 'system' };
          lockedOrder.transitionEscrow(
            'RELEASED',
            systemActor,
            'Auto-released: 24-hour buyer inspection window expired.'
          );

          await lockedOrder.save({ session });
          await session.commitTransaction();
          console.log(`✅ [Cron] Auto-released order ${lockedOrder._id}`);
        } catch (err) {
          await session.abortTransaction();
          console.error(`❌ [Cron] Failed to release order ${order._id}:`, err.message);
        } finally {
          session.endSession();
        }
      }
    } catch (error) {
      console.error('[Cron] Escrow release error:', error);
    }
  });
};

/**
 * Stale Order Alert Cron Job
 * ─────────────────────────────────────────────────────────────────
 * Runs once a day at midnight.
 * Alerts (logs) orders still in SHIPPED state after 14 days.
 * In production this could send an email to the admin.
 */
const startStaleOrderCron = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('🔍 [Cron] Checking for stale SHIPPED orders...');
    try {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const staleOrders = await Order.find({
        escrowStatus: 'SHIPPED',
        shippedAt:    { $lte: fourteenDaysAgo },
      }).populate('buyer seller', 'name email');

      if (staleOrders.length > 0) {
        console.warn(`⚠️  [Cron] ALERT: ${staleOrders.length} order(s) stuck in SHIPPED for 14+ days:`);
        staleOrders.forEach(o => {
          console.warn(`   → Order ${o._id} | Buyer: ${o.buyer?.email} | Seller: ${o.seller?.email} | Tracking: ${o.trackingNumber}`);
        });
        // TODO: send email to admin when email service is set up
      } else {
        console.log('[Cron] No stale orders found.');
      }
    } catch (error) {
      console.error('[Cron] Stale order check error:', error);
    }
  });
};

/**
 * Start all cron jobs. Called from server.js on startup.
 */
exports.startEscrowCronJob = () => {
  startEscrowReleaseCron();
  startStaleOrderCron();
  console.log('🕐 Escrow auto-release cron started (hourly).');
  console.log('🔍 Stale order alert cron started (daily midnight).');
};
