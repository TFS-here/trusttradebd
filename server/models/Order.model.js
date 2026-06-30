const mongoose = require('mongoose');

/**
 * Escrow State Machine
 * ────────────────────────────────────────────────────────────────
 *
 *  LOCKED ──► SHIPPED ──► DELIVERED ──► RELEASED
 *    │            │
 *    └──────────► ON_HOLD ──► REFUNDED
 *
 *  LOCKED    : Buyer placed order, funds deducted from buyer wallet
 *              and held in escrow. Seller must ship.
 *  SHIPPED   : Seller marked as shipped. Buyer must confirm delivery.
 *  DELIVERED : Buyer confirmed receipt. Funds queued for release.
 *  RELEASED  : Funds transferred to seller wallet. Final state.
 *  ON_HOLD   : Admin flagged for dispute. No fund movement allowed.
 *  REFUNDED  : Admin issued refund. Funds returned to buyer. Final.
 */
const ESCROW_STATES = ['LOCKED', 'SHIPPED', 'DELIVERED', 'RELEASED', 'ON_HOLD', 'REFUNDED'];

/**
 * Valid state transitions. Only these moves are legal.
 * Controller must validate against this map before any state change.
 */
const VALID_TRANSITIONS = {
  LOCKED: ['SHIPPED', 'ON_HOLD'],
  SHIPPED: ['DELIVERED', 'ON_HOLD'],
  DELIVERED: ['RELEASED', 'ON_HOLD'],
  ON_HOLD: ['RELEASED', 'REFUNDED'],
  RELEASED: [], // terminal
  REFUNDED: [], // terminal
};

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    // Snapshot product data at time of purchase (immutable record)
    title: { type: String, required: true },
    price: { type: Number, required: true }, // Price at purchase time
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String, default: '' },
  },
  { _id: false }
);

const escrowEventSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ESCROW_STATES },
    to: { type: String, enum: ESCROW_STATES, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who triggered the change
    actorRole: { type: String, enum: ['buyer', 'seller', 'admin', 'system'] },
    note: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // ── Parties ───────────────────────────────────────────────────
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Buyer reference is required.'],
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller reference is required.'],
    },

    // ── Order Items ───────────────────────────────────────────────
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length >= 1,
        message: 'An order must have at least one item.',
      },
    },

    // ── Financials ────────────────────────────────────────────────
    totalAmount: {
      type: Number,
      required: true,
      min: [0.01, 'Order total must be positive.'],
    },

    // Platform fee (e.g. 2.5%) deducted from seller on release
    platformFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    sellerReceives: {
      type: Number,
      default: 0,
    },

    // ── Escrow ────────────────────────────────────────────────────
    escrowStatus: {
      type: String,
      enum: {
        values: ESCROW_STATES,
        message: `Escrow status must be one of: ${ESCROW_STATES.join(', ')}.`,
      },
      default: 'LOCKED',
    },

    // Full audit trail of every state change
    escrowHistory: {
      type: [escrowEventSchema],
      default: [],
    },

    // ── Shipping ──────────────────────────────────────────────────
    shippingAddress: {
      fullName: { type: String, default: '' },
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      district: { type: String, default: '' },
      postalCode: { type: String, default: '' },
      phone: { type: String, default: '' },
    },

    trackingNumber: {
      type: String,
      default: '',
      trim: true,
    },

    shippedAt: Date,
    deliveredAt: Date,
    releasedAt: Date,
    refundedAt: Date,

    // ── Dispute ───────────────────────────────────────────────────
    disputeNote: {
      type: String,
      default: '',
    },

    // ── Review tracking ───────────────────────────────────────────
    isReviewed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });
orderSchema.index({ escrowStatus: 1 });
orderSchema.index({ createdAt: -1 });

// ── Instance method: attempt state transition ─────────────────────
/**
 * Validates and applies an escrow state transition.
 * Appends to escrowHistory and sets relevant timestamp fields.
 * Does NOT save — caller must call order.save() after.
 *
 * @param {string} newStatus   Target state
 * @param {Object} actor       { _id, role } of the user making the change
 * @param {string} [note]      Optional admin/system note
 * @throws {Error}             If transition is not permitted
 */
orderSchema.methods.transitionEscrow = function (newStatus, actor, note = '') {
  const allowed = VALID_TRANSITIONS[this.escrowStatus];

  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(
      `Invalid escrow transition: ${this.escrowStatus} → ${newStatus}. ` +
        `Allowed: [${(allowed || []).join(', ') || 'none — terminal state'}]`
    );
  }

  // Append audit event
  this.escrowHistory.push({
    from: this.escrowStatus,
    to: newStatus,
    actor: actor._id,
    actorRole: actor.role,
    note,
    timestamp: new Date(),
  });

  this.escrowStatus = newStatus;

  // Set timestamp fields
  const now = new Date();
  if (newStatus === 'SHIPPED') this.shippedAt = now;
  if (newStatus === 'DELIVERED') this.deliveredAt = now;
  if (newStatus === 'RELEASED') this.releasedAt = now;
  if (newStatus === 'REFUNDED') this.refundedAt = now;
};

// ── Statics ───────────────────────────────────────────────────────
orderSchema.statics.ESCROW_STATES = ESCROW_STATES;
orderSchema.statics.VALID_TRANSITIONS = VALID_TRANSITIONS;

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
