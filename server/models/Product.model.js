const mongoose = require('mongoose');

const CATEGORIES = [
  'electronics',
  'clothing',
  'books',
  'home',
  'sports',
  'beauty',
  'food',
  'toys',
  'automotive',
  'other',
];

const productSchema = new mongoose.Schema(
  {
    // ── Core info ─────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Product title is required.'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters.'],
      maxlength: [120, 'Title must not exceed 120 characters.'],
    },

    description: {
      type: String,
      required: [true, 'Product description is required.'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters.'],
      maxlength: [2000, 'Description must not exceed 2000 characters.'],
    },

    price: {
      type: Number,
      required: [true, 'Price is required.'],
      min: [0.01, 'Price must be greater than 0.'],
    },

    images: {
      type: [String],
      validate: {
        validator: (arr) => arr.length <= 8,
        message: 'A product can have at most 8 images.',
      },
      default: [],
    },

    category: {
      type: String,
      required: [true, 'Category is required.'],
      enum: {
        values: CATEGORIES,
        message: `Category must be one of: ${CATEGORIES.join(', ')}.`,
      },
    },

    tags: {
      type: [String],
      default: [],
    },

    // ── Stock ─────────────────────────────────────────────────────
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required.'],
      min: [0, 'Stock cannot be negative.'],
      default: 1,
    },

    /**
     * IMPORTANT: Products are NEVER deleted after being purchased.
     * isActive controls visibility. Sold-out products become inactive
     * but remain in the DB for order history integrity.
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    // Set to true when at least one order has been placed on this product.
    // Once true, the product record is immutable for deletion.
    hasSold: {
      type: Boolean,
      default: false,
    },

    // ── Ownership ─────────────────────────────────────────────────
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller reference is required.'],
    },

    // ── Aggregate review stats (denormalised for performance) ─────
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    reviewCount: {
      type: Number,
      default: 0,
    },

    // ── Admin control ─────────────────────────────────────────────
    isBanned: {
      type: Boolean,
      default: false,
    },

    bannedReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────
productSchema.index({ seller: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1, isBanned: 1 });
productSchema.index({ title: 'text', description: 'text', tags: 'text' }); // Full-text search
productSchema.index({ createdAt: -1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });

// ── Virtual: isInStock ────────────────────────────────────────────
productSchema.virtual('isInStock').get(function () {
  return this.stock > 0;
});

// ── Pre-save: auto deactivate on zero stock ───────────────────────
productSchema.pre('save', function (next) {
  if (this.isModified('stock') && this.stock === 0) {
    this.isActive = false;
  }
  next();
});

// ── Static: decrement stock atomically ───────────────────────────
/**
 * Atomically decrements stock. Fails if stock would go below 0.
 * Returns the updated document or null if out of stock.
 *
 * @param {string} productId
 * @param {number} qty
 */
productSchema.statics.decrementStock = async function (productId, qty = 1) {
  const updated = await this.findOneAndUpdate(
    { _id: productId, stock: { $gte: qty }, isActive: true, isBanned: false },
    {
      $inc: { stock: -qty },
      $set: { hasSold: true },
    },
    { new: true }
  );

  if (updated && updated.stock === 0) {
    updated.isActive = false;
    await updated.save();
  }

  return updated; // null means out of stock / product unavailable
};

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
