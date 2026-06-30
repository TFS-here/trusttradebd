const mongoose = require('mongoose');

/**
 * Transaction types:
 *
 *  DEPOSIT      — User tops up their wallet
 *  WITHDRAWAL   — User withdraws from wallet
 *  ORDER_LOCK   — Funds locked in escrow (buyer → escrow)
 *  ORDER_RELEASE— Funds released to seller (escrow → seller)
 *  REFUND       — Funds returned to buyer (escrow → buyer)
 *  FEE          — Platform fee deducted from seller on release
 */
const TRANSACTION_TYPES = [
  'DEPOSIT',
  'WITHDRAWAL',
  'ORDER_LOCK',
  'ORDER_RELEASE',
  'REFUND',
  'FEE',
];

const TRANSACTION_STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'];

const transactionSchema = new mongoose.Schema(
  {
    // ── Who ───────────────────────────────────────────────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required.'],
    },

    // ── What ──────────────────────────────────────────────────────
    type: {
      type: String,
      required: [true, 'Transaction type is required.'],
      enum: {
        values: TRANSACTION_TYPES,
        message: `Type must be one of: ${TRANSACTION_TYPES.join(', ')}.`,
      },
    },

    amount: {
      type: Number,
      required: [true, 'Amount is required.'],
      min: [0.01, 'Amount must be positive.'],
    },

    // Wallet balance after this transaction (for reconciliation)
    balanceBefore: {
      type: Number,
      required: true,
    },

    balanceAfter: {
      type: Number,
      required: true,
    },

    // ── Why ───────────────────────────────────────────────────────
    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      default: 'COMPLETED',
    },

    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description too long.'],
      default: '',
    },

    // ── Reference ─────────────────────────────────────────────────
    // Link back to the order that triggered this transaction (if any)
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },

    // Links transactions that cancel each other (e.g. refund reverses a lock)
    relatedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },

    // ── Meta ──────────────────────────────────────────────────────
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // System, admin, or the user themselves
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ order: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ createdAt: -1 });

// ── Static: create a transaction and update user wallet atomically ─
/**
 * Records a wallet mutation + creates a transaction document.
 * Uses a Mongoose session to ensure atomicity.
 *
 * @param {Object} session   Mongoose session (caller must manage)
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.type        TRANSACTION_TYPES member
 * @param {number} params.amount
 * @param {string} [params.description]
 * @param {string} [params.orderId]
 * @param {string} [params.initiatedBy]
 * @param {'balance'|'escrowBalance'} params.walletField
 * @param {'increment'|'decrement'} params.operation
 * @returns {Promise<Object>} { transaction, updatedUser }
 */
transactionSchema.statics.record = async function (
  session,
  {
    userId,
    type,
    amount,
    description = '',
    orderId = null,
    initiatedBy = null,
    walletField = 'balance',
    operation = 'increment',
  }
) {
  const User = mongoose.model('User');

  const user = await User.findById(userId).session(session);
  if (!user) throw new Error(`User ${userId} not found for transaction.`);

  const balanceBefore = user.wallet[walletField];
  const newBalance =
    operation === 'increment' ? balanceBefore + amount : balanceBefore - amount;

  if (newBalance < 0) {
    throw new Error(`Insufficient ${walletField}: ${balanceBefore} < ${amount}`);
  }

  user.wallet[walletField] = parseFloat(newBalance.toFixed(2));
  await user.save({ session });

  const [tx] = await this.create(
    [
      {
        user: userId,
        type,
        amount,
        balanceBefore: parseFloat(balanceBefore.toFixed(2)),
        balanceAfter: parseFloat(newBalance.toFixed(2)),
        description,
        order: orderId,
        initiatedBy: initiatedBy || userId,
        status: 'COMPLETED',
      },
    ],
    { session }
  );

  return { transaction: tx, updatedUser: user };
};

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
