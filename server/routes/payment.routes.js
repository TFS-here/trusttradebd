const express = require('express');
const {
  initiatePayment,
  handleIPN,
  handleSuccess,
  handleFail,
  handleCancel,
} = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');
const { roleGuard } = require('../middleware/role.middleware');
const { idempotencyGuard, idempotencyGuardByField } = require('../middleware/idempotency.middleware');

const router = express.Router();

// ── Public Routes (SSLCommerz callbacks) ──────────────────────────
// These MUST be public — SSLCommerz sends POST requests directly
// to these endpoints. No JWT auth is possible here.
//
// Security is enforced by:
//   1. Server-to-server val_id verification (IPN handler)
//   2. Idempotency guard (prevents double-processing)
//   3. Amount cross-check against DB (IPN handler)

router.post(
  '/ipn',
  idempotencyGuardByField('payment-ipn', 'tran_id'), // SECURITY STANDARD #4
  handleIPN
);

router.post('/success', handleSuccess);
router.post('/fail',    handleFail);
router.post('/cancel',  handleCancel);

// ── Protected Routes ─────────────────────────────────────────────
router.use(protect);

// Initiate a payment session — buyer only, with idempotency guard
router.post(
  '/initiate',
  roleGuard('buyer'),
  idempotencyGuard('payment-initiate'),
  initiatePayment
);

module.exports = router;
