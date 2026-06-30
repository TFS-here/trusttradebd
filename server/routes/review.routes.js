const express = require('express');
const {
  checkEligibility,
  canReviewProduct,
  createReview,
  getProductReviews,
  getSellerReviews,
  replyToReview,
  getMyReviews,
} = require('../controllers/review.controller');
const { protect } = require('../middleware/auth.middleware');
const { roleGuard } = require('../middleware/role.middleware');

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────
router.get('/product/:productId', getProductReviews);
router.get('/seller/:sellerId',   getSellerReviews);

// ── Authenticated ─────────────────────────────────────────────────
router.use(protect);

router.get('/my-reviews',                    getMyReviews);
router.get('/eligibility/:orderId',          roleGuard('buyer'), checkEligibility);
router.get('/can-review/:productId',         roleGuard('buyer'), canReviewProduct);
router.post('/',                             roleGuard('buyer'), createReview);
router.post('/:id/reply',                   roleGuard('seller'), replyToReview);

module.exports = router;
