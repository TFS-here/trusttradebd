const mongoose = require('mongoose');
const Dispute = require('../models/Dispute.model');
const Order = require('../models/Order.model');
const Transaction = require('../models/Transaction.model');
const ApiError = require('../utils/apiError');

/**
 * Get all disputes (Admin only)
 */
exports.getAllDisputes = async (req, res, next) => {
  try {
    const disputes = await Dispute.find()
      .populate('order', 'totalAmount escrowStatus')
      .populate('buyer', 'name email')
      .populate('seller', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      status: 'success',
      results: disputes.length,
      data: disputes
    });
  } catch (error) {
    next(new ApiError(error.message, 500));
  }
};

/**
 * resolveDisputeInBuyerFavor
 * ─────────────────────────────────────────────────────────────────
 * Handles an admin ruling where a buyer proves a seller sent an incorrect/fraudulent item.
 *
 * ACID Transaction ensures:
 *  - Verify dispute is 'Pending'
 *  - Refund Buyer: Increment Wallet by (totalAmount) -> productPrice + deliveryFee
 *  - Penalize Seller: Deduct (deliveryFee) directly from Wallet
 *  - Move Order to 'REFUNDED'
 *  - Change Dispute to 'Buyer_Won'
 */
exports.resolveDisputeInBuyerFavor = async (req, res, next) => {
  const { disputeId } = req.params;
  const { adminNotes, deliveryFeePenalty = 100 } = req.body; // Delivery fee default 100 BDT

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispute = await Dispute.findById(disputeId)
      .populate('order')
      .session(session);

    if (!dispute) {
      throw new ApiError('Dispute not found.', 404);
    }

    if (dispute.status !== 'Pending') {
      throw new ApiError(`Dispute is already resolved (Status: ${dispute.status}).`, 400);
    }

    const order = dispute.order;
    if (!order) {
      throw new ApiError('Associated order not found.', 404);
    }

    // Step 1: Remove escrow hold from buyer
    // If the order is ON_HOLD, its funds are in the buyer's escrowBalance.
    await Transaction.record(session, {
      userId: dispute.buyer,
      type: 'REFUND',
      amount: order.totalAmount,
      walletField: 'escrowBalance',
      operation: 'decrement',
      orderId: order._id,
      initiatedBy: req.user._id,
      description: `Dispute ${disputeId} won: Escrow hold released`,
    });

    // Step 2: Refund the Buyer completely (productPrice + deliveryFee)
    // Here we refund the full totalAmount to the buyer's spendable balance
    await Transaction.record(session, {
      userId: dispute.buyer,
      type: 'REFUND',
      amount: order.totalAmount,
      walletField: 'balance',
      operation: 'increment',
      orderId: order._id,
      initiatedBy: req.user._id,
      description: `Dispute ${disputeId} won: Full refund issued`,
    });

    // Step 3: Penalize the Seller (deduct deliveryFee directly)
    // Transaction.record handles negative balance if we bypass or if we just use create directly.
    // wait, Transaction.record throws if newBalance < 0. We need a custom logic to allow negative balance for penalty.
    const seller = await mongoose.model('User').findById(dispute.seller).session(session);
    const balanceBefore = seller.wallet.balance;
    const balanceAfter = balanceBefore - deliveryFeePenalty;
    
    // We update seller directly to allow negative balance
    seller.wallet.balance = balanceAfter;
    await seller.save({ session });

    await Transaction.create(
      [{
        user: seller._id,
        type: 'WITHDRAWAL', // Using WITHDRAWAL or FEE as penalty
        amount: deliveryFeePenalty,
        balanceBefore,
        balanceAfter,
        order: order._id,
        initiatedBy: req.user._id,
        description: `Dispute penalty: Delivery fee deducted for fraudulent item`,
        status: 'COMPLETED'
      }],
      { session }
    );

    // Step 4: Update Order Status
    order.transitionEscrow('RETURNED', req.user, `Dispute resolved in buyer favor. Admin notes: ${adminNotes}`);
    await order.save({ session });

    // Step 5: Update Dispute Status
    dispute.status = 'Buyer_Won';
    dispute.adminNotes = adminNotes;
    dispute.resolvedBy = req.user._id;
    dispute.resolvedAt = new Date();
    await dispute.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: 'success',
      message: 'Dispute resolved in buyer favor successfully.',
      data: {
        dispute,
        order
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(new ApiError(error.message, error.statusCode || 500));
  }
};

/**
 * POST /api/disputes
 * submitDispute (Buyer)
 * ─────────────────────────────────────────────────────────────────
 * Buyer submits a dispute for a DELIVERED order within the 24h window.
 */
exports.submitDispute = async (req, res, next) => {
  try {
    const { orderId, reason, unboxingVideoUrl } = req.body;

    if (!orderId || !reason || !unboxingVideoUrl) {
      return next(new ApiError('Order ID, reason, and unboxing video URL are required.', 400));
    }

    const order = await Order.findById(orderId);
    if (!order) return next(new ApiError('Order not found.', 404));

    if (order.buyer.toString() !== req.user._id.toString()) {
      return next(new ApiError('Unauthorized to dispute this order.', 403));
    }

    if (order.escrowStatus !== 'DELIVERED') {
      return next(new ApiError('Dispute can only be opened for delivered orders.', 400));
    }

    // Check if within 24h window
    if (order.escrowReleaseDate && order.escrowReleaseDate < new Date()) {
      return next(new ApiError('Dispute window has closed.', 400));
    }

    // Check if dispute already exists
    const existing = await Dispute.findOne({ order: orderId });
    if (existing) {
      return next(new ApiError('A dispute already exists for this order.', 400));
    }

    // Start transaction to create dispute and hold order
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const dispute = await Dispute.create([{
        order: orderId,
        buyer: order.buyer,
        seller: order.seller,
        reason,
        unboxingVideoUrl
      }], { session });

      const buyerActor = { _id: req.user._id, role: 'buyer' };
      order.transitionEscrow('ON_HOLD', buyerActor, 'Buyer raised a dispute.');
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(201).json({
        status: 'success',
        message: 'Dispute submitted successfully. Order is on hold.',
        data: dispute[0]
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    next(new ApiError(error.message, 500));
  }
};

/**
 * POST /api/disputes/:disputeId/resolve-seller-favor
 * resolveDisputeInSellerFavor (Admin)
 * ─────────────────────────────────────────────────────────────────
 * Admin rejects buyer's dispute (e.g., video doesn't show defect).
 * Releases funds to seller.
 */
exports.resolveDisputeInSellerFavor = async (req, res, next) => {
  const { disputeId } = req.params;
  const { adminNotes } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispute = await Dispute.findById(disputeId).populate('order').session(session);
    if (!dispute) throw new ApiError('Dispute not found.', 404);
    if (dispute.status !== 'Pending') throw new ApiError('Dispute already resolved.', 400);

    const order = dispute.order;
    if (!order) throw new ApiError('Order not found.', 404);

    // Use releaseFunds utility to handle the atomic transfer and fee deduction
    const { releaseFunds } = require('../utils/escrow');
    const { sellerReceives, platformFee } = await releaseFunds(session, {
      buyerId: order.buyer,
      sellerId: order.seller,
      amount: order.totalAmount,
      orderId: order._id,
      initiatedBy: req.user._id
    });

    order.sellerReceives = sellerReceives;
    order.platformFee = platformFee;

    const adminActor = { _id: req.user._id, role: 'admin' };
    order.transitionEscrow('RELEASED', adminActor, `Dispute rejected. Admin notes: ${adminNotes}`);
    await order.save({ session });

    dispute.status = 'Seller_Won';
    dispute.adminNotes = adminNotes;
    dispute.resolvedBy = req.user._id;
    dispute.resolvedAt = new Date();
    await dispute.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: 'success',
      message: 'Dispute rejected. Funds released to seller.',
      data: { dispute, order }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(new ApiError(error.message, error.statusCode || 500));
  }
};
