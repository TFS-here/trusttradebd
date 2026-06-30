const express = require('express');
const {
  getBalance,
  deposit,
  withdraw,
  getTransactions,
  depositSuccess,
  depositFail,
  depositCancel,
} = require('../controllers/wallet.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// ── Public Routes (SSLCommerz IPN / Callbacks) ────────────────────
// These must be public as SSLCommerz sends POST requests directly.
router.post('/deposit/success', depositSuccess);
router.post('/deposit/fail',    depositFail);
router.post('/deposit/cancel',  depositCancel);

// ── Protected Routes ──────────────────────────────────────────────
router.use(protect);

router.get('/balance',       getBalance);
router.post('/deposit',      deposit);
router.post('/withdraw',     withdraw);
router.get('/transactions',  getTransactions);

module.exports = router;
