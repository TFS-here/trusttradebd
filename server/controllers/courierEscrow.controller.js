const mongoose = require('mongoose');
const Order = require('../models/Order.model');
const cron = require('node-cron');
const { releaseFunds } = require('../utils/escrow');
const ApiError = require('../utils/apiError');

/**
 * Pathao Webhook Handler
 * ─────────────────────────────────────────────────────────────────
 * Listens for Pathao Sandbox events.
 * If status === 'delivered', transitions Order to 'DELIVERED'
 * and sets escrowReleaseDate to 72 hours in the future.
 */
exports.pathaoWebhook = async (req, res, next) => {
  try {
    // Typical Pathao webhook payload might contain consignment_id, order_id, status
    const { consignment_id, order_id, status } = req.body;

    if (status && status.toLowerCase() === 'delivered') {
      // Find the order by its tracking number (consignment_id) or internal order_id
      const order = await Order.findOne({ 
        $or: [{ trackingNumber: consignment_id }, { _id: order_id }] 
      });

      if (order && order.escrowStatus === 'SHIPPED') {
        // Set escrow release date exactly 72 hours (3 days) forward
        const releaseDate = new Date();
        releaseDate.setHours(releaseDate.getHours() + 72);

        // We use system actor for this automated transition
        const systemActor = { _id: null, role: 'system' };
        
        order.transitionEscrow('DELIVERED', systemActor, 'Pathao Webhook: Item Delivered.');
        order.escrowReleaseDate = releaseDate;
        await order.save();
      }
    }

    // Always return 200 OK to acknowledge receipt of the webhook
    res.status(200).json({ received: true });
  } catch (error) {
    return next(new ApiError(error.message, 500));
  }
};

/**
 * Vercel Cron Job Endpoint
 * ─────────────────────────────────────────────────────────────────
 * Targeted by vercel.json cron configuration every hour.
 * Scans for orders where status === 'DELIVERED' 
 * and escrowReleaseDate <= new Date().
 * Processes funds using atomic escrow release logic.
 */
exports.autoReleaseEscrowCronEndpoint = async (req, res, next) => {
  // Optional: Secure this endpoint by checking a secret key sent by Vercel
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ status: 'fail', message: 'Unauthorized' });
  }

  console.log('⏳ Running Escrow Auto-Release (Vercel Cron Trigger)...');
  try {
    const now = new Date();
    
    // Find orders that are DELIVERED and past their inspection window
    const pendingReleaseOrders = await Order.find({
      escrowStatus: 'DELIVERED',
      escrowReleaseDate: { $lte: now }
    });

    console.log(`Found ${pendingReleaseOrders.length} orders eligible for auto-release.`);
    let processedCount = 0;

    for (const order of pendingReleaseOrders) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // Re-fetch within session to lock
        const lockedOrder = await Order.findById(order._id).session(session);

        // Atomic fund release (deducts from buyer escrow, credits seller wallet, takes platform fee)
        const { sellerReceives, platformFee } = await releaseFunds(session, {
          buyerId: lockedOrder.buyer,
          sellerId: lockedOrder.seller,
          amount: lockedOrder.totalAmount,
          orderId: lockedOrder._id,
          initiatedBy: null // System initiated
        });

        lockedOrder.sellerReceives = sellerReceives;
        lockedOrder.platformFee = platformFee;
        
        const systemActor = { _id: null, role: 'system' };
        lockedOrder.transitionEscrow('RELEASED', systemActor, 'Cron: Inspection window expired (72h). Funds auto-released.');
        
        await lockedOrder.save({ session });
        await session.commitTransaction();
        processedCount++;
        console.log(`✅ Auto-released order ${lockedOrder._id}`);
      } catch (err) {
        await session.abortTransaction();
        console.error(`❌ Failed to auto-release order ${order._id}:`, err.message);
      } finally {
        session.endSession();
      }
    }

    res.status(200).json({
      status: 'success',
      message: `Processed ${processedCount} orders for auto-release.`,
    });
  } catch (error) {
    console.error('Escrow Cron Job Error:', error);
    return next(new ApiError(error.message, 500));
  }
};
