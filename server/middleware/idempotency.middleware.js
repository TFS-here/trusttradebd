const IdempotencyKey = require('../models/IdempotencyKey.model');
const ApiError = require('../utils/apiError');

/**
 * Idempotency Guard Middleware
 * ────────────────────────────────────────────────────────────────
 * Prevents duplicate processing of mutating operations (refunds,
 * releases, payouts, IPN webhooks) when a user double-clicks or
 * a webhook fires multiple times.
 *
 * Usage:
 *   router.post('/refund', idempotencyGuard('refund'), refundHandler);
 *
 * The client sends:  Header `idempotency-key: <unique-uuid>`
 *
 * For IPN routes (no client control), use `idempotencyGuardByField`
 * which derives the key from a request body field (e.g. `tran_id`).
 *
 * Behaviour:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Key not found    → create PROCESSING → proceed         │
 *   │  Key PROCESSING   → 409 Conflict (in-flight)            │
 *   │  Key COMPLETED    → return cached response (replay)     │
 *   │  Key FAILED       → allow retry (delete old, proceed)   │
 *   └──────────────────────────────────────────────────────────┘
 *
 * After the handler completes, call `req.cacheIdempotencyResponse()`
 * to store the result. The middleware patches `res.json` to do
 * this automatically.
 */

/**
 * Creates an idempotency guard middleware that reads the key
 * from the `idempotency-key` or `x-idempotency-key` header.
 *
 * @param {string} routeName  Logical name for the operation (for audit)
 * @returns {Function} Express middleware
 */
const idempotencyGuard = (routeName) => {
  return async (req, res, next) => {
    const key =
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'];

    // If no key provided, proceed without idempotency protection.
    // This is intentional — not all callers may support it,
    // and we don't want to break backwards compatibility.
    if (!key) return next();

    await _processIdempotency(key, routeName, req, res, next);
  };
};

/**
 * Creates an idempotency guard that derives the key from a
 * field in `req.body`. Used for IPN/webhook routes where the
 * caller (SSLCommerz) doesn't send custom headers.
 *
 * @param {string} routeName  Logical name for the operation
 * @param {string} bodyField  Field name to use as key (e.g. 'tran_id')
 * @returns {Function} Express middleware
 */
const idempotencyGuardByField = (routeName, bodyField) => {
  return async (req, res, next) => {
    const key = req.body?.[bodyField];

    if (!key) return next(); // No key available, skip guard

    // Prefix to avoid collisions with header-based keys
    const prefixedKey = `ipn:${routeName}:${key}`;
    await _processIdempotency(prefixedKey, routeName, req, res, next);
  };
};

/**
 * Core idempotency logic — shared by both guard variants.
 */
async function _processIdempotency(key, routeName, req, res, next) {
  try {
    // Attempt atomic upsert — only one request wins if two arrive simultaneously.
    // `$setOnInsert` ensures we only set these fields on creation, not on find.
    const existing = await IdempotencyKey.findOneAndUpdate(
      { key },
      {
        $setOnInsert: {
          key,
          route: routeName,
          status: 'PROCESSING',
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,            // Return the document after upsert
        rawResult: true,      // Gives us `lastErrorObject.updatedExisting`
      }
    );

    const doc = existing.value;
    const wasExisting = existing.lastErrorObject?.updatedExisting === true;

    if (wasExisting) {
      // ── Key already exists ───────────────────────────────────

      if (doc.status === 'COMPLETED' && doc.responseBody !== null) {
        // Replay the cached response — no re-processing
        return res.status(doc.statusCode || 200).json(doc.responseBody);
      }

      if (doc.status === 'PROCESSING') {
        // Another request is currently processing this key
        return next(
          ApiError.conflict(
            'This operation is already being processed. Please wait.'
          )
        );
      }

      if (doc.status === 'FAILED') {
        // Previous attempt failed — allow retry by resetting status
        await IdempotencyKey.findOneAndUpdate(
          { key },
          { status: 'PROCESSING', responseBody: null, statusCode: null }
        );
        // Fall through to proceed
      }
    }

    // ── Key is new (or reset from FAILED) — proceed ──────────────

    // Monkey-patch res.json to automatically cache the response.
    // This is cleaner than requiring every handler to call a helper.
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Fire-and-forget the cache update — don't block the response
      IdempotencyKey.findOneAndUpdate(
        { key },
        {
          status: 'COMPLETED',
          statusCode: res.statusCode,
          responseBody: body,
        }
      ).catch((err) => {
        console.error('[Idempotency] Failed to cache response:', err.message);
      });

      return originalJson(body);
    };

    // Attach a cleanup function for error cases
    req._idempotencyKey = key;
    req._markIdempotencyFailed = async () => {
      try {
        await IdempotencyKey.findOneAndUpdate(
          { key },
          { status: 'FAILED' }
        );
      } catch (err) {
        console.error('[Idempotency] Failed to mark as FAILED:', err.message);
      }
    };

    next();
  } catch (err) {
    // If the idempotency check itself fails (DB down, etc.),
    // let the request proceed rather than blocking all operations.
    // This is a deliberate "fail-open" for availability.
    console.error('[Idempotency] Guard error (proceeding anyway):', err.message);
    next();
  }
}

module.exports = { idempotencyGuard, idempotencyGuardByField };
