const Message = require('../models/Message.model');
const Order = require('../models/Order.model');
const ApiError = require('../utils/apiError');

// Strict RegEx patterns to detect off-platform leaks
const PHONE_REGEX = /(?:\+?88)?01[3-9]\d{8}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PAYMENT_KEYWORD_REGEX = /\b(bkash|nagad|rocket|upay|send money|cash out|personal number)\b/i;

const isMessageSafe = (text) => {
  if (!text) return true;
  
  const strippedText = text.replace(/[\s-.]/g, '');
  if (/(?:\+?88)?01[3-9]\d{8}/.test(strippedText)) return false;
  
  if (EMAIL_REGEX.test(text)) return false;
  if (PAYMENT_KEYWORD_REGEX.test(text)) return false;

  return true;
};

/**
 * Send a Message (Vercel-compatible REST endpoint)
 * POST /api/chat
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { orderId, text, attachmentUrl } = req.body;
    const senderId = req.user._id;

    if (!orderId || (!text && !attachmentUrl)) {
      return next(new ApiError('Missing orderId or message content.', 400));
    }

    // Basic validation: Ensure order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return next(new ApiError('Order not found.', 404));
    }

    // Ensure userId is either buyer or seller
    if (order.buyer.toString() !== senderId.toString() && order.seller.toString() !== senderId.toString()) {
      return next(new ApiError('Unauthorized to send messages in this chat.', 403));
    }

    // CRITICAL FRAUD FILTER
    if (!isMessageSafe(text)) {
      return next(new ApiError('⚠️ Sharing off-platform contact or payment details violates TrustTrade BD safety guidelines.', 400));
    }

    const message = await Message.create({
      order: orderId,
      sender: senderId,
      text,
      attachmentUrl
    });

    res.status(201).json({
      status: 'success',
      data: message
    });
  } catch (error) {
    return next(new ApiError(error.message, 500));
  }
};

/**
 * Get Messages for an Order
 * GET /api/chat/:orderId
 */
exports.getMessages = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(orderId);
    if (!order) {
      return next(new ApiError('Order not found.', 404));
    }

    if (order.buyer.toString() !== userId.toString() && order.seller.toString() !== userId.toString()) {
      return next(new ApiError('Unauthorized to view this chat.', 403));
    }

    const messages = await Message.find({ order: orderId }).sort('createdAt');

    res.status(200).json({
      status: 'success',
      results: messages.length,
      data: messages
    });
  } catch (error) {
    return next(new ApiError(error.message, 500));
  }
};
