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
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// Order input validation schema
const validateOrderPayload = (body) => {
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return 'Order must contain at least one item.';
  }
  for (const item of body.items) {
    if (!item.productId) return 'Each order item must specify a valid productId.';
    const qty = parseInt(item.quantity, 10);
    if (!qty || qty < 1 || qty > 10) return 'Item quantity must be between 1 and 10.';
  }
  if (!body.shippingAddress || typeof body.shippingAddress !== 'object') {
    return 'Shipping address is required.';
  }
  const { address, city, phone } = body.shippingAddress;
  if (!address || !city || !phone) {
    return 'Shipping address (address, city, phone) is required.';
  }
  return null;
};

// All order routes require authentication
router.use(protect);

// ── Buyer + Seller (shared) ───────────────────────────────────────
router.get('/', getOrders);
router.get('/seller/analytics', roleGuard('seller'), getSellerAnalytics);
router.get('/:id', getOrder);
router.get('/:id/receipt', downloadReceipt); // PDF download

// ── Buyer only ────────────────────────────────────────────────────
router.post('/', roleGuard('buyer'), validate(validateOrderPayload), placeOrder); // Wallet-funded
router.post('/create-for-payment', roleGuard('buyer'), validate(validateOrderPayload), createOrder); // SSLCommerz-funded
router.patch('/:id/confirm-delivery', roleGuard('buyer'), confirmDelivery);
router.patch('/:id/cancel', roleGuard('buyer'), cancelOrder);

// ── Seller only ───────────────────────────────────────────────────
router.patch('/:id/ship', roleGuard('seller'), markShipped);

module.exports = router;
