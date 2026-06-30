const Question = require('../models/Question.model');
const Product  = require('../models/Product.model');
const ApiError = require('../utils/apiError');

/**
 * GET /api/qa/product/:productId
 * Public — list all visible Q&A for a product, paginated.
 */
const getProductQuestions = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(20, parseInt(req.query.limit, 10) || 10);
    const skip  = (page - 1) * limit;

    const filter = { product: req.params.productId, isVisible: true };

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .populate('askedBy', 'name avatar')
        .populate('seller',  'name avatar sellerProfile.shopName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Question.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: 'success',
      data: {
        questions,
        pagination: {
          total, page, limit,
          pages:   Math.ceil(total / limit),
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
 * POST /api/qa/product/:productId
 * Any authenticated user — ask a question.
 */
const askQuestion = async (req, res, next) => {
  try {
    const { question } = req.body;

    if (!question || question.trim().length < 5) {
      return next(ApiError.badRequest('Question must be at least 5 characters.'));
    }
    if (question.trim().length > 500) {
      return next(ApiError.badRequest('Question must not exceed 500 characters.'));
    }

    const product = await Product.findById(req.params.productId).select('seller isActive isBanned');
    if (!product || product.isBanned) return next(ApiError.notFound('Product'));

    const doc = await Question.create({
      product:    product._id,
      seller:     product.seller,
      askedBy:    req.user._id,
      askerName:  req.user.name,
      question:   question.trim(),
    });

    const populated = await Question.findById(doc._id)
      .populate('askedBy', 'name avatar');

    return res.status(201).json({
      status:  'success',
      message: 'Question submitted. The seller will be notified.',
      data: { question: populated },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/qa/:id/answer
 * Seller only — answer or update their answer to a question.
 */
const answerQuestion = async (req, res, next) => {
  try {
    const { answer } = req.body;

    if (!answer || answer.trim().length < 2) {
      return next(ApiError.badRequest('Answer cannot be empty.'));
    }
    if (answer.trim().length > 1000) {
      return next(ApiError.badRequest('Answer must not exceed 1000 characters.'));
    }

    const q = await Question.findById(req.params.id);
    if (!q) return next(ApiError.notFound('Question'));

    // Only the seller of this product can answer
    if (q.seller.toString() !== req.user._id.toString()) {
      return next(ApiError.forbidden('Only the seller of this product can answer.'));
    }

    q.answer = { text: answer.trim(), answeredAt: new Date() };
    await q.save();

    const populated = await Question.findById(q._id)
      .populate('askedBy', 'name avatar')
      .populate('seller',  'name avatar sellerProfile.shopName');

    return res.status(200).json({
      status:  'success',
      message: 'Answer posted.',
      data: { question: populated },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/qa/:id
 * The user who asked OR the seller OR admin can delete.
 */
const deleteQuestion = async (req, res, next) => {
  try {
    const q = await Question.findById(req.params.id);
    if (!q) return next(ApiError.notFound('Question'));

    const isAsker  = q.askedBy?.toString() === req.user._id.toString();
    const isSeller = q.seller.toString()   === req.user._id.toString();
    const isAdmin  = req.user.role         === 'admin';

    if (!isAsker && !isSeller && !isAdmin) {
      return next(ApiError.forbidden('You cannot delete this question.'));
    }

    await Question.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      status: 'success',
      message: 'Question deleted.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/qa/seller/pending
 * Seller — see all unanswered questions across their products.
 */
const getSellerPendingQuestions = async (req, res, next) => {
  try {
    const questions = await Question.find({
      seller:        req.user._id,
      isVisible:     true,
      'answer.text': { $in: ['', null, undefined] },
    })
      .populate('product', 'title images')
      .populate('askedBy', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      status: 'success',
      data: { questions, total: questions.length },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProductQuestions,
  askQuestion,
  answerQuestion,
  deleteQuestion,
  getSellerPendingQuestions,
};
