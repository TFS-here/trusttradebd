const mongoose = require('mongoose');

/**
 * IdempotencyKey Model
 * ────────────────────────────────────────────────────────────────
 * Prevents duplicate processing of webhooks, refunds, releases,
 * and any other operation that must execute exactly once.
 *
 * How it works:
 *   1. Before processing, attempt an atomic upsert on the key.
 *   2. If the key already exists with status 'COMPLETED',
 *      return the cached response (replay).
 *   3. If the key is new (upsert created it), proceed and
 *      update with the response once done.
 *   4. TTL index auto-purges keys after 24 hours.
 *
 * Race-condition safety:
 *   The unique index on `key` combined with `findOneAndUpdate`
 *   + `upsert: true` ensures that even if two identical requests
 *   arrive at the exact same millisecond, only one will win the
 *   upsert — the other will see the existing document.
 */

const idempotencyKeySchema = new mongoose.Schema(
  {
    // The unique key — either from `idempotency-key` header
    // or derived from SSLCommerz `tran_id`
    key: {
      type: String,
      required: [true, 'Idempotency key is required.'],
      unique: true,
      trim: true,
      index: true,
    },

    // Which route/operation this key was used for (audit trail)
    route: {
      type: String,
      required: true,
      trim: true,
    },

    // Processing status — used to detect in-flight vs. completed
    status: {
      type: String,
      enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PROCESSING',
    },

    // Cached HTTP status code of the original response
    statusCode: {
      type: Number,
      default: null,
    },

    // Cached response body for replay on duplicate requests
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Auto-expire after 24 hours — keeps the collection lean
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // 24 hours in seconds
    },
  },
  {
    timestamps: false, // We manage createdAt ourselves for TTL
  }
);

// ── Indexes ───────────────────────────────────────────────────────
// TTL index is defined via `expires` on createdAt above.
// Unique index on `key` is defined inline above.

const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencyKeySchema);
module.exports = IdempotencyKey;
