const express = require('express');
const {
  adminLogin,
  getDashboard,
  getUsers,
  getUser,
  getUserProducts,
  blockUser,
  unblockUser,
  changeUserRole,
  getOrders,
  holdOrder,
  releaseOrder,
  refundOrder,
  simulateDelivery,
  simulateStatus,
  banProduct,
  unbanProduct,
  hideReview,
} = require('../controllers/admin.controller');
const { protect } = require('../middleware/auth.middleware');
const { roleGuard } = require('../middleware/role.middleware');

const router = express.Router();

// ── Hidden login ──────────────────────────────────────────────────
// Not mounted under /api/auth — completely separate entry point.
// Only succeeds for role === 'admin' accounts.
router.post('/login', adminLogin);

// ── Double guard: all routes below require auth + admin role ──────
// protect  → valid JWT, non-blocked account
// roleGuard('admin') → role must be 'admin'
router.use(protect, roleGuard('admin'));

// ── Dashboard ─────────────────────────────────────────────────────
router.get('/dashboard', getDashboard);

// ── User management ───────────────────────────────────────────────
router.get('/users',                getUsers);
router.get('/users/:id',            getUser);
router.get('/users/:id/products',   getUserProducts);
router.patch('/users/:id/block',    blockUser);
router.patch('/users/:id/unblock',  unblockUser);
router.patch('/users/:id/role',     changeUserRole);

// ── Order / dispute management ────────────────────────────────────
router.get('/orders',               getOrders);
router.patch('/orders/:id/hold',    holdOrder);
router.patch('/orders/:id/release', releaseOrder);
router.patch('/orders/:id/refund',  refundOrder);
router.post('/orders/:id/simulate-delivery', simulateDelivery);
router.post('/orders/:id/simulate-status',   simulateStatus);

// ── Product moderation ────────────────────────────────────────────
router.patch('/products/:id/ban',   banProduct);
router.patch('/products/:id/unban', unbanProduct);

// ── Review moderation ─────────────────────────────────────────────
router.patch('/reviews/:id/hide',   hideReview);

module.exports = router;
