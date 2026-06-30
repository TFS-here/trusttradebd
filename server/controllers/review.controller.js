const Review = require('../models/Review.model');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const ApiError = require('../utils/apiError');

// ── Helpers ───────────────────────────────────────────────────────

const populateReview = (query) =>
  query
    .populate('reviewer', 'name avatar createdAt')
    .populate('seller', 'name avatar sellerProfile.shopName');

// ── Controllers ───────────────────────────────────────────────────

/**
 * GET /api/reviews/eligibility/:orderId
 * Buyer only — check if they can review a specific order.
 * Returns eligibility status and, if eligible, the product details.
 *
 * Rules:
 *   1. Order must be RELEASED
 *   2. Buyer must be the order's buyer
 *   3. No review already exists for this order
 */
const checkEligibility = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('items.product', 'title images');

    if (!order) return next(ApiError.notFound('Order'));

    if (order.buyer.toString() !== req.user._id.toString()) {
      return next(ApiError.forbidden('You can only review your own orders.'));
    }

    if (order.escrowStatus !== 'RELEASED') {
      return res.status(200).json({
        status: 'success',
        data: {
          eligible: false,
          reason: `Order must be RELEASED before reviewing. Current status: ${order.escrowStatus}.`,
        },
      });
    }

    // Check if already reviewed
    const existing = await Review.findOne({
      order: order._id,
      reviewer: req.user._id,
    });

    if (existing) {
      return res.status(200).json({
        status: 'success',
        data: {
          eligible: false,
          reason: 'You have already reviewed this order.',
          existingReviewId: existing._id,
        },
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        eligible: true,
        order: {
          _id: order._id,
          items: order.items,
          seller: order.seller,
          totalAmount: order.totalAmount,
          releasedAt: order.releasedAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reviews
 * Buyer only — submit a review for a RELEASED order.
 *
 * One review per order, enforced by:
 *   1. This controller (explicit duplicate check with clear error)
 *   2. The compound unique index { order, reviewer } as a DB-level safety net
 *
 * Side effects (via Review.model post-save hook):
 *   - Product.rating and Product.reviewCount recalculated automatically
 *   - Order.isReviewed set to true
 */
const createReview = async (req, res, next) => {
  try {
    const { orderId, rating, comment } = req.body;

    // ── Input validation ─────────────────────────────────────────
    const errors = [];
    if (!orderId) errors.push({ field: 'orderId', message: 'Order ID is required.' });
    if (!rating || rating < 1 || rating > 5)
      errors.push({ field: 'rating', message: 'Rating must be between 1 and 5.' });
    if (!comment || comment.trim().length < 10)
      errors.push({ field: 'comment', message: 'Review must be at least 10 characters.' });
    if (comment && comment.trim().length > 1000)
      errors.push({ field: 'comment', message: 'Review must not exceed 1000 characters.' });

    if (errors.length) return next(ApiError.badRequest('Validation failed.', errors));

    // ── Verify order eligibility ──────────────────────────────────
    const order = await Order.findById(orderId);
    if (!order) return next(ApiError.notFound('Order'));

    if (order.buyer.toString() !== req.user._id.toString()) {
      return next(ApiError.forbidden('You can only review your own orders.'));
    }

    if (order.escrowStatus !== 'RELEASED') {
      return next(
        ApiError.badRequest(
          `Reviews can only be submitted for completed orders. ` +
          `This order is ${order.escrowStatus}.`
        )
      );
    }

    if (order.isReviewed) {
      return next(ApiError.conflict('You have already reviewed this order.'));
    }

    // ── Reviews are per-order not per-product
    // For multi-item orders, the review covers the overall order experience.
    // We attach it to the first product for display purposes.
    const primaryProductId = order.items[0]?.product;
    if (!primaryProductId) {
      return next(ApiError.internal('Order has no items.'));
    }

    const product = await Product.findById(primaryProductId);
    if (!product) return next(ApiError.notFound('Product'));

    // ── Create review ─────────────────────────────────────────────
    const review = await Review.create({
      product: primaryProductId,
      reviewer: req.user._id,
      seller: order.seller,
      order: order._id,
      rating: parseInt(rating, 10),
      comment: comment.trim(),
    });

    // Mark order as reviewed (prevents duplicate submission)
    await Order.findByIdAndUpdate(orderId, { isReviewed: true });

    // Update seller's aggregate rating on their profile
    const sellerReviews = await Review.find({
      seller: order.seller,
      isVisible: true,
    }).select('rating');

    if (sellerReviews.length > 0) {
      const avg = sellerReviews.reduce((sum, r) => sum + r.rating, 0) / sellerReviews.length;
      await require('../models/User.model').findByIdAndUpdate(order.seller, {
        'sellerProfile.rating': parseFloat(avg.toFixed(2)),
        'sellerProfile.reviewCount': sellerReviews.length,
      });
    }

    const populated = await populateReview(Review.findById(review._id));

    return res.status(201).json({
      status: 'success',
      message: 'Review submitted successfully.',
      data: { review: populated },
    });
  } catch (err) {
    // Catch the compound unique index violation at DB level
    if (err.code === 11000) {
      return next(ApiError.conflict('You have already reviewed this order.'));
    }
    next(err);
  }
};

/**
 * GET /api/reviews/product/:productId
 * Public — paginated reviews for a product, with rating breakdown.
 */
const getProductReviews = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(20, parseInt(req.query.limit, 10) || 10);
    const skip  = (page - 1) * limit;

    const filter = {
      product: req.params.productId,
      isVisible: true,
    };

    // Optional star filter (e.g. ?stars=5 shows only 5-star reviews)
    if (req.query.stars) {
      const stars = parseInt(req.query.stars, 10);
      if (stars >= 1 && stars <= 5) filter.rating = stars;
    }

    const SORT_MAP = {
      newest:   { createdAt: -1 },
      oldest:   { createdAt: 1 },
      highest:  { rating: -1 },
      lowest:   { rating: 1 },
    };
    const sort = SORT_MAP[req.query.sort] || SORT_MAP.newest;

    const [reviews, total, breakdown] = await Promise.all([
      populateReview(Review.find(filter))
        .sort(sort)
        .skip(skip)
        .limit(limit),

      Review.countDocuments(filter),

      // Rating breakdown: count per star (1–5)
      Review.aggregate([
        { $match: { product: require('mongoose').Types.ObjectId.createFromHexString(req.params.productId), isVisible: true } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
    ]);

    // Shape breakdown into { 5: n, 4: n, 3: n, 2: n, 1: n }
    const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    breakdown.forEach(({ _id, count }) => { ratingBreakdown[_id] = count; });

    return res.status(200).json({
      status: 'success',
      data: {
        reviews,
        ratingBreakdown,
        pagination: {
          total, page, limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reviews/seller/:sellerId
 * Public — all reviews a seller has received across all their products.
 */
const getSellerReviews = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(20, parseInt(req.query.limit, 10) || 10);
    const skip  = (page - 1) * limit;

    const filter = { seller: req.params.sellerId, isVisible: true };

    const [reviews, total] = await Promise.all([
      populateReview(Review.find(filter))
        .populate('product', 'title images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: 'success',
      data: {
        reviews,
        pagination: {
          total, page, limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reviews/:id/reply
 * Seller only — reply to a review on their product.
 * One reply per review; subsequent calls update the existing reply.
 */
const replyToReview = async (req, res, next) => {
  try {
    const { comment } = req.body;

    if (!comment?.trim()) {
      return next(ApiError.badRequest('Reply comment is required.'));
    }

    if (comment.trim().length > 500) {
      return next(ApiError.badRequest('Reply must not exceed 500 characters.'));
    }

    const review = await Review.findById(req.params.id);
    if (!review) return next(ApiError.notFound('Review'));

    // Only the seller who received the review can reply
    if (review.seller.toString() !== req.user._id.toString()) {
      return next(ApiError.forbidden('You can only reply to reviews on your own products.'));
    }

    review.sellerReply = {
      comment: comment.trim(),
      repliedAt: new Date(),
    };

    await review.save();

    const populated = await populateReview(Review.findById(review._id));

    return res.status(200).json({
      status: 'success',
      message: review.sellerReply.repliedAt ? 'Reply updated.' : 'Reply posted.',
      data: { review: populated },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reviews/my-reviews
 * Buyer — all reviews they have written.
 */
const getMyReviews = async (req, res, next) => {
  try {
    const reviews = await populateReview(
      Review.find({ reviewer: req.user._id })
    )
      .populate('product', 'title images price')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'success',
      data: { reviews },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * GET /api/reviews/can-review/:productId
 * Buyer only — checks if the logged-in user has a RELEASED, unreviewed
 * order containing this product. Returns the orderId they should use.
 *
 * This powers the "Write a Review" button on the product page.
 */
const canReviewProduct = async (req, res, next) => {
  try {
    // Find a RELEASED order where:
    //  - this buyer placed it
    //  - it contains the product
    //  - it hasn't been reviewed yet
    const order = await Order.findOne({
      buyer:        req.user._id,
      escrowStatus: 'RELEASED',
      isReviewed:   false,
      'items.product': req.params.productId,
    }).select('_id items totalAmount releasedAt');

    if (!order) {
      return res.status(200).json({
        status: 'success',
        data: {
          canReview: false,
          reason: 'You must purchase and receive this product before reviewing.',
        },
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        canReview: true,
        orderId:   order._id,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  checkEligibility,
  canReviewProduct,
  createReview,
  getProductReviews,
  getSellerReviews,
  replyToReview,
  getMyReviews,
};
