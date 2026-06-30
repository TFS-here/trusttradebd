const mongoose = require('mongoose');

/**
 * Question
 * ─────────────────────────────────────────────────────────────────
 * Anyone (logged in or not) can ask.
 * Only the product's seller can answer.
 * One answer per question (seller can edit it).
 */
const questionSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Who asked (null = anonymous guest)
    askedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    askerName: {
      type: String,
      trim: true,
      default: 'Anonymous',
      maxlength: [60, 'Name too long.'],
    },

    question: {
      type: String,
      required: [true, 'Question text is required.'],
      trim: true,
      minlength: [5,    'Question must be at least 5 characters.'],
      maxlength: [500,  'Question must not exceed 500 characters.'],
    },

    // Seller answer (null = unanswered)
    answer: {
      text:       { type: String, trim: true, maxlength: 1000, default: '' },
      answeredAt: { type: Date },
    },

    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

questionSchema.index({ product: 1, createdAt: -1 });
questionSchema.index({ seller: 1 });

const Question = mongoose.model('Question', questionSchema);
module.exports = Question;
