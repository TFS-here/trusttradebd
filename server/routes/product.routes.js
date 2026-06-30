const express = require('express');
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getMyProducts,
  restockProduct,
} = require('../controllers/product.controller');
const { protect } = require('../middleware/auth.middleware');
const { roleGuard } = require('../middleware/role.middleware');

const router = express.Router();

// ── Public routes ─────────────────────────────────────────────────
router.get('/', getProducts);
router.get('/:id', getProduct);

// ── Seller / Admin protected ──────────────────────────────────────
router.use(protect);

// Seller dashboard — own products
router.get('/seller/my-products', roleGuard('seller'), getMyProducts);
router.post('/', roleGuard('seller'), createProduct);
router.put('/:id', roleGuard('seller', 'admin'), updateProduct);
router.delete('/:id', roleGuard('seller', 'admin'), deleteProduct);
router.patch('/:id/restock', roleGuard('seller', 'admin'), restockProduct);

module.exports = router;
