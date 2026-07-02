const mongoose = require('mongoose');
const Dispute = require('../models/Dispute.model');
const Order = require('../models/Order.model');
const Transaction = require('../models/Transaction.model');
const ApiError = require('../utils/apiError');

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
    order.transitionEscrow('REFUNDED', req.user, `Dispute resolved in buyer favor. Admin notes: ${adminNotes}`);
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
