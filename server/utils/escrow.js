const mongoose = require('mongoose');
const Transaction = require('../models/Transaction.model');

/**
 * escrow.js — Atomic wallet operations for every escrow transition.
 *
 * Every function here:
 *   1. Opens (or uses a provided) MongoDB session
 *   2. Mutates wallet balances via Transaction.record() — which is itself atomic
 *   3. Returns all created transactions for audit purposes
 *   4. Rolls back everything if any step fails
 *
 * Callers are responsible for:
 *   - Validating the state transition is legal (Order.transitionEscrow)
 *   - Saving the order document (order.save({ session }))
 *
 * Platform fee: PLATFORM_FEE_PERCENT is deducted from seller on RELEASED.
 */

const PLATFORM_FEE_PERCENT = 2.5; // 2.5% platform cut

/**
 * lockFunds
 * ─────────────────────────────────────────────────────────────────
 * Called when buyer places an order (LOCKED state).
 * Deducts totalAmount from buyer.wallet.balance
 * and adds it to buyer.wallet.escrowBalance.
 *
 * Think of it as: buyer pays into an escrow vault.
 */
const lockFunds = async (session, { buyerId, amount, orderId }) => {
  // Step 1: Deduct from buyer's spendable balance
  const { transaction: debitTx } = await Transaction.record(session, {
    userId: buyerId,
    type: 'ORDER_LOCK',
    amount,
    walletField: 'balance',
    operation: 'decrement',
    orderId,
    initiatedBy: buyerId,
    description: `Funds locked in escrow for order #${orderId}`,
  });

  // Step 2: Add to buyer's escrow balance (tracks how much is held)
  const { transaction: escrowTx } = await Transaction.record(session, {
    userId: buyerId,
    type: 'ORDER_LOCK',
    amount,
    walletField: 'escrowBalance',
    operation: 'increment',
    orderId,
    initiatedBy: buyerId,
    description: `Escrow hold placed for order #${orderId}`,
  });

  return { debitTx, escrowTx };
};

/**
 * releaseFunds
 * ─────────────────────────────────────────────────────────────────
 * Called when buyer confirms delivery (RELEASED state).
 * 1. Removes escrow hold from buyer (escrowBalance ↓)
 * 2. Deducts platform fee
 * 3. Credits net amount to seller's wallet
 *
 * Returns: { sellerReceives, platformFee }
 */
const releaseFunds = async (session, { buyerId, sellerId, amount, orderId, initiatedBy }) => {
  const platformFee = parseFloat(((amount * PLATFORM_FEE_PERCENT) / 100).toFixed(2));
  const sellerReceives = parseFloat((amount - platformFee).toFixed(2));

  // Step 1: Release escrow hold from buyer
  await Transaction.record(session, {
    userId: buyerId,
    type: 'ORDER_RELEASE',
    amount,
    walletField: 'escrowBalance',
    operation: 'decrement',
    orderId,
    initiatedBy,
    description: `Escrow released for order #${orderId}`,
  });

  // Step 2: Credit seller (minus platform fee)
  const { transaction: sellerTx } = await Transaction.record(session, {
    userId: sellerId,
    type: 'ORDER_RELEASE',
    amount: sellerReceives,
    walletField: 'balance',
    operation: 'increment',
    orderId,
    initiatedBy,
    description: `Payment received for order #${orderId} (after ${PLATFORM_FEE_PERCENT}% fee)`,
  });

  // Step 3: Record platform fee for analytics (no wallet mutation)
  if (platformFee > 0) {
    await Transaction.create(
      [
        {
          user: sellerId,
          type: 'FEE',
          amount: platformFee,
          balanceBefore: sellerTx.balanceAfter,
          balanceAfter: sellerTx.balanceAfter,
          description: `Platform fee deducted for order #${orderId}`,
          order: orderId,
          initiatedBy,
          status: 'COMPLETED',
        },
      ],
      { session }
    );
  }

  return { sellerTx, sellerReceives, platformFee };
};

/**
 * refundFunds
 * ─────────────────────────────────────────────────────────────────
 * Called by admin when dispute resolves in buyer's favour (REFUNDED).
 * 1. Removes escrow hold from buyer (escrowBalance ↓)
 * 2. Returns full amount to buyer's spendable balance (balance ↑)
 */
const refundFunds = async (session, { buyerId, amount, orderId, initiatedBy }) => {
  // Step 1: Remove escrow hold
  await Transaction.record(session, {
    userId: buyerId,
    type: 'REFUND',
    amount,
    walletField: 'escrowBalance',
    operation: 'decrement',
    orderId,
    initiatedBy,
    description: `Escrow hold released for refund — order #${orderId}`,
  });

  // Step 2: Return to buyer's spendable balance
  const { transaction: refundTx } = await Transaction.record(session, {
    userId: buyerId,
    type: 'REFUND',
    amount,
    walletField: 'balance',
    operation: 'increment',
    orderId,
    initiatedBy,
    description: `Refund issued for order #${orderId}`,
  });

  return { refundTx };
};

module.exports = { lockFunds, releaseFunds, refundFunds, PLATFORM_FEE_PERCENT };
