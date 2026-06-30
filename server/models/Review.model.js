const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    // ── Relationships ─────────────────────────────────────────────
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required.'],
    },

    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer reference is required.'],
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller reference is required.'],
    },

    // The order this review is for (enforces: one review per order)
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required.'],
    },

    // ── Content ───────────────────────────────────────────────────
    rating: {
      type: Number,
      required: [true, 'Rating is required.'],
      min: [1, 'Rating must be at least 1.'],
      max: [5, 'Rating must be at most 5.'],
    },

    comment: {
      type: String,
      required: [true, 'Review comment is required.'],
      trim: true,
      minlength: [10, 'Comment must be at least 10 characters.'],
      maxlength: [1000, 'Comment must not exceed 1000 characters.'],
    },

    // ── Moderation ────────────────────────────────────────────────
    isVisible: {
      type: Boolean,
      default: true,
    },

    hiddenReason: {
      type: String,
      default: '',
    },

    // ── Seller reply ──────────────────────────────────────────────
    sellerReply: {
      comment: { type: String, trim: true, maxlength: 500, default: '' },
      repliedAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ── Compound unique: one review per order (buyer can't review twice) ─
reviewSchema.index({ order: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ product: 1, isVisible: 1 });
reviewSchema.index({ seller: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1 });

// ── Post-save: recalculate product aggregate rating ───────────────
reviewSchema.post('save', async function () {
  await recalculateProductRating(this.product);
});

// ── Post-remove: recalculate when a review is deleted ────────────
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) await recalculateProductRating(doc.product);
});

/**
 * Recalculates the average rating and review count for a product
 * and persists the denormalized values on the Product document.
 */
async function recalculateProductRating(productId) {
  const Review = mongoose.model('Review');
  const Product = mongoose.model('Product');

  const stats = await Review.aggregate([
    { $match: { product: productId, isVisible: true } },
    {
      $group: {
        _id: '$product',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      rating: parseFloat(stats[0].avgRating.toFixed(2)),
      reviewCount: stats[0].count,
    });
  } else {
    // No reviews left — reset to zero
    await Product.findByIdAndUpdate(productId, { rating: 0, reviewCount: 0 });
  }
}

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
