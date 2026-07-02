const express = require('express');
const {
  placeOrder,
  createOrder,
  getOrders,
  getSellerAnalytics,
  getOrder,
  markShipped,
  confirmDelivery,
  cancelOrder,
  downloadReceipt,
} = require('../controllers/order.controller');
const { protect } = require('../middleware/auth.middleware');
const { roleGuard } = require('../middleware/role.middleware');

const router = express.Router();

// All order routes require authentication
router.use(protect);

// ── Buyer + Seller (shared) ───────────────────────────────────────
router.get('/',              getOrders);
router.get('/seller/analytics', roleGuard('seller'), getSellerAnalytics);
router.get('/:id',           getOrder);
router.get('/:id/receipt',   downloadReceipt);   // PDF download

// ── Buyer only ────────────────────────────────────────────────────
router.post('/',                       roleGuard('buyer'), placeOrder);           // Wallet-funded
router.post('/create-for-payment',     roleGuard('buyer'), createOrder);          // SSLCommerz-funded
router.patch('/:id/confirm-delivery',  roleGuard('buyer'), confirmDelivery);
router.patch('/:id/cancel',            roleGuard('buyer'), cancelOrder);

// ── Seller only ───────────────────────────────────────────────────
router.patch('/:id/ship', roleGuard('seller'), markShipped);

module.exports = router;

