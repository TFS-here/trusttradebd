const mongoose = require('mongoose');
const User = require('../models/User.model');
const Product = require('../models/Product.model');
const Order = require('../models/Order.model');
const Transaction = require('../models/Transaction.model');
const Review = require('../models/Review.model');
const { generateToken } = require('../utils/generateToken');
const { releaseFunds, refundFunds } = require('../utils/escrow');
const ApiError = require('../utils/apiError');

// ─────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/login
 * Hidden admin login — only succeeds for role === 'admin' accounts.
 * Deliberately returns the same error for wrong credentials AND
 * non-admin accounts (prevents role enumeration).
 */
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(ApiError.badRequest('Email and password are required.'));
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      role: 'admin',           // hard-coded — regular users can never log in here
    }).select('+password +passwordChangedAt');

    const isMatch = user ? await user.comparePassword(password) : false;

    // Identical error for "not found" and "wrong password" (timing-safe)
    if (!user || !isMatch) {
      return next(ApiError.unauthorized('Invalid credentials.'));
    }

    if (!user.isActive || user.isBlocked) {
      return next(ApiError.forbidden('This admin account is disabled.'));
    }

    const token = generateToken(user);

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 4 * 60 * 60 * 1000, // 4-hour session for admin (shorter than buyer/seller)
    });

    return res.status(200).json({
      status: 'success',
      token,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────
// DASHBOARD ANALYTICS
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/dashboard
 * Aggregated platform stats for the admin overview page.
 * All queries run in parallel for performance.
 */
const getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalUsers,
      newUsersThisMonth,
      totalProducts,
      activeProducts,
      totalOrders,
      ordersThisMonth,
      revenueAgg,
      revenueLastMonth,
      escrowBreakdown,
      blockedUsers,
      disputedOrders,
      recentOrders,
      topSellers,
    ] = await Promise.all([
      // Users
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: { $ne: 'admin' }, createdAt: { $gte: startOfMonth } }),

      // Products
      Product.countDocuments({ isBanned: false }),
      Product.countDocuments({ isActive: true, isBanned: false }),

      // Orders
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),

      // Revenue this month (platform fees from RELEASED orders)
      Transaction.aggregate([
        { $match: { type: 'FEE', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      // Revenue last month (for % change)
      Transaction.aggregate([
        {
          $match: {
            type: 'ORDER_RELEASE',
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      // Orders grouped by escrow status
      Order.aggregate([
        { $group: { _id: '$escrowStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Blocked users count
      User.countDocuments({ isBlocked: true }),

      // Disputed orders
      Order.countDocuments({ escrowStatus: 'ON_HOLD' }),

      // 5 most recent orders
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('buyer', 'name email')
        .populate('seller', 'name sellerProfile.shopName')
        .select('totalAmount escrowStatus createdAt items'),

      // Top 5 sellers by total sales count
      User.find({ role: 'seller' })
        .sort({ 'sellerProfile.totalSales': -1 })
        .limit(5)
        .select('name email avatar sellerProfile.shopName sellerProfile.totalSales sellerProfile.rating'),
    ]);

    // Platform GMV (Gross Merchandise Value) — sum of all RELEASED orders
    const gmvAgg = await Order.aggregate([
      { $match: { escrowStatus: 'RELEASED' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);

    const platformRevenue = revenueAgg[0]?.total ?? 0;
    const lastMonthRevenue = revenueLastMonth[0]?.total ?? 0;
    const revenueChange = lastMonthRevenue > 0
      ? parseFloat((((platformRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1))
      : null;

    // Shape escrow breakdown into a map
    const escrowMap = Object.fromEntries(
      escrowBreakdown.map(({ _id, count }) => [_id, count])
    );

    return res.status(200).json({
      status: 'success',
      data: {
        overview: {
          totalUsers,
          newUsersThisMonth,
          blockedUsers,
          totalProducts,
          activeProducts,
          totalOrders,
          ordersThisMonth,
          disputedOrders,
          gmv: parseFloat((gmvAgg[0]?.total ?? 0).toFixed(2)),
          platformRevenue: parseFloat(platformRevenue.toFixed(2)),
          revenueChange,
        },
        escrowBreakdown: escrowMap,
        recentOrders,
        topSellers,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Paginated, filterable user list.
 */
const getUsers = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;

    const filter = { role: { $ne: 'admin' } }; // never expose admin accounts

    if (req.query.role)      filter.role = req.query.role;
    if (req.query.isBlocked) filter.isBlocked = req.query.isBlocked === 'true';
    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ name: re }, { email: re }];
    }

    const SORT_MAP = {
      newest:    { createdAt: -1 },
      oldest:    { createdAt: 1 },
      name:      { name: 1 },
      balance:   { 'wallet.balance': -1 },
    };
    const sort = SORT_MAP[req.query.sort] || SORT_MAP.newest;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(User.publicFields())
        .sort(sort)
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: 'success',
      data: {
        users,
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
 * GET /api/admin/users/:id
 * Full user profile with order history and transaction summary.
 */
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(User.publicFields());
    if (!user || user.role === 'admin') return next(ApiError.notFound('User'));

    // Recent orders
    const orders = await Order.find({
      $or: [{ buyer: user._id }, { seller: user._id }],
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('totalAmount escrowStatus createdAt buyer seller');

    // Wallet summary
    const txSummary = await Transaction.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json({
      status: 'success',
      data: { user, orders, txSummary },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/users/:id/products
 * Get all products of a seller (including banned and inactive).
 */
const getUserProducts = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(ApiError.notFound('User'));
    if (user.role !== 'seller') return next(ApiError.badRequest('User is not a seller'));

    const products = await Product.find({ seller: user._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'success',
      data: { products },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/users/:id/block
 * Block a user with a mandatory reason.
 * Blocked users cannot log in or make any authenticated request.
 */
const blockUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return next(ApiError.badRequest('A reason for blocking is required.'));
    }

    const user = await User.findById(req.params.id);
    if (!user)             return next(ApiError.notFound('User'));
    if (user.role === 'admin') return next(ApiError.forbidden('Admin accounts cannot be blocked.'));
    if (user.isBlocked)    return next(ApiError.conflict('User is already blocked.'));

    user.isBlocked     = true;
    user.blockedReason = reason.trim();
    user.blockedAt     = new Date();
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: `User ${user.email} has been blocked.`,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          isBlocked: user.isBlocked,
          blockedReason: user.blockedReason,
          blockedAt: user.blockedAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/users/:id/unblock
 * Restore a blocked user's access.
 */
const unblockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)          return next(ApiError.notFound('User'));
    if (!user.isBlocked) return next(ApiError.conflict('User is not blocked.'));

    user.isBlocked     = false;
    user.blockedReason = '';
    user.blockedAt     = undefined;
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: `User ${user.email} has been unblocked.`,
      data: { userId: user._id, isBlocked: false },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/users/:id/role
 * Promote buyer → seller or vice versa.
 * Cannot promote to admin via API (seeder only).
 */
const changeUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['buyer', 'seller'].includes(role)) {
      return next(ApiError.badRequest('Role must be buyer or seller.'));
    }

    const user = await User.findById(req.params.id);
    if (!user)             return next(ApiError.notFound('User'));
    if (user.role === 'admin') return next(ApiError.forbidden('Admin role cannot be changed via API.'));

    user.role = role;
    if (role === 'seller' && !user.sellerProfile?.shopName) {
      user.sellerProfile = {
        shopName: user.name,
        shopDescription: '',
        totalSales: 0,
        rating: 0,
        reviewCount: 0,
      };
    }
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: `${user.email} is now a ${role}.`,
      data: { userId: user._id, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────
// ORDER & DISPUTE MANAGEMENT
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/orders
 * All orders — paginated with status filter.
 */
const getOrders = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.escrowStatus = req.query.status.toUpperCase();
    if (req.query.search) {
      // Search by order id prefix
      if (mongoose.Types.ObjectId.isValid(req.query.search)) {
        filter._id = req.query.search;
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('buyer', 'name email')
        .populate('seller', 'name email sellerProfile.shopName'),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: 'success',
      data: {
        orders,
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
 * PATCH /api/admin/orders/:id/hold
 * Flag any active order as ON_HOLD for admin review.
 * No funds move. Blocks buyer and seller from taking further action.
 */
const holdOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return next(ApiError.badRequest('A reason for placing the order on hold is required.'));
    }

    const order = await Order.findById(req.params.id);
    if (!order) return next(ApiError.notFound('Order'));

    if (['RELEASED', 'REFUNDED'].includes(order.escrowStatus)) {
      return next(ApiError.badRequest(`Cannot hold a ${order.escrowStatus} order — it is already finalised.`));
    }

    if (order.escrowStatus === 'ON_HOLD') {
      return next(ApiError.conflict('Order is already on hold.'));
    }

    order.transitionEscrow('ON_HOLD', req.user, reason.trim());
    order.disputeNote = reason.trim();
    await order.save();

    const populated = await Order.findById(order._id)
      .populate('buyer', 'name email')
      .populate('seller', 'name email');

    return res.status(200).json({
      status: 'success',
      message: 'Order placed on hold. No funds will move until resolved.',
      data: { order: populated },
    });
  } catch (err) {
    if (!err.isOperational) return next(ApiError.badRequest(err.message));
    next(err);
  }
};

/**
 * PATCH /api/admin/orders/:id/release
 * Admin manually releases funds to seller (resolves dispute in seller's favour).
 * Transition: ON_HOLD → RELEASED
 */
const releaseOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) { await session.abortTransaction(); return next(ApiError.notFound('Order')); }

    if (order.escrowStatus !== 'ON_HOLD') {
      await session.abortTransaction();
      return next(ApiError.badRequest(`Order must be ON_HOLD to release. Current: ${order.escrowStatus}.`));
    }

    const { note } = req.body;
    order.transitionEscrow('RELEASED', req.user, note || 'Admin manually released funds.');

    const { sellerReceives, platformFee } = await releaseFunds(session, {
      buyerId: order.buyer,
      sellerId: order.seller,
      amount: order.totalAmount,
      orderId: order._id,
      initiatedBy: req.user._id,
    });

    order.sellerReceives = sellerReceives;
    order.platformFee    = platformFee;
    order.disputeNote    = note || '';
    await order.save({ session });
    await session.commitTransaction();

    const populated = await Order.findById(order._id)
      .populate('buyer', 'name email')
      .populate('seller', 'name email');

    return res.status(200).json({
      status: 'success',
      message: `Funds released. Seller receives ৳${sellerReceives}.`,
      data: { order: populated },
    });
  } catch (err) {
    await session.abortTransaction();
    if (!err.isOperational) return next(ApiError.badRequest(err.message));
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * PATCH /api/admin/orders/:id/refund
 * Admin issues a refund (resolves dispute in buyer's favour).
 * Transition: ON_HOLD → REFUNDED
 */
const refundOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) { await session.abortTransaction(); return next(ApiError.notFound('Order')); }

    if (order.escrowStatus !== 'ON_HOLD') {
      await session.abortTransaction();
      return next(ApiError.badRequest(`Order must be ON_HOLD to refund. Current: ${order.escrowStatus}.`));
    }

    const { note } = req.body;
    order.transitionEscrow('REFUNDED', req.user, note || 'Admin issued refund.');

    await refundFunds(session, {
      buyerId: order.buyer,
      amount: order.totalAmount,
      orderId: order._id,
      initiatedBy: req.user._id,
    });

    // Restore stock for each item
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity }, $set: { isActive: true } },
        { session }
      );
    }

    order.disputeNote = note || '';
    await order.save({ session });
    await session.commitTransaction();

    const populated = await Order.findById(order._id)
      .populate('buyer', 'name email')
      .populate('seller', 'name email');

    return res.status(200).json({
      status: 'success',
      message: `Refund of ৳${order.totalAmount} issued to buyer.`,
      data: { order: populated },
    });
  } catch (err) {
    await session.abortTransaction();
    if (!err.isOperational) return next(ApiError.badRequest(err.message));
    next(err);
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────
// PRODUCT MANAGEMENT
// ─────────────────────────────────────────────────────────────────

/**
 * PATCH /api/admin/products/:id/ban
 * Remove a product from all listings (policy violation, counterfeit, etc.)
 */
const banProduct = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return next(ApiError.badRequest('A reason for banning this product is required.'));
    }

    const product = await Product.findById(req.params.id);
    if (!product) return next(ApiError.notFound('Product'));

    if (product.isBanned) return next(ApiError.conflict('Product is already banned.'));

    product.isBanned     = true;
    product.bannedReason = reason.trim();
    product.isActive     = false;
    await product.save();

    return res.status(200).json({
      status: 'success',
      message: 'Product banned and removed from all listings.',
      data: { productId: product._id, isBanned: true, bannedReason: product.bannedReason },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/products/:id/unban
 */
const unbanProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)       return next(ApiError.notFound('Product'));
    if (!product.isBanned) return next(ApiError.conflict('Product is not banned.'));

    product.isBanned     = false;
    product.bannedReason = '';
    product.isActive     = product.stock > 0; // only reactivate if stock exists
    await product.save();

    return res.status(200).json({
      status: 'success',
      message: 'Product unbanned.',
      data: { productId: product._id, isBanned: false, isActive: product.isActive },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────
// REVIEW MODERATION
// ─────────────────────────────────────────────────────────────────

/**
 * PATCH /api/admin/reviews/:id/hide
 * Hide an abusive or fraudulent review without deleting it (audit trail).
 */
const hideReview = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return next(ApiError.badRequest('A reason is required.'));

    const review = await Review.findById(req.params.id);
    if (!review) return next(ApiError.notFound('Review'));

    review.isVisible    = false;
    review.hiddenReason = reason.trim();
    await review.save(); // post-save hook will recalculate product rating

    return res.status(200).json({
      status: 'success',
      message: 'Review hidden. Product rating recalculated.',
      data: { reviewId: review._id, isVisible: false },
    });
  } catch (err) {
    next(err);
  }
};
/**
 * POST /api/admin/orders/:id/simulate-status
 * Simulate any Pathao courier status change for sandbox testing.
 * Body: { status: "Delivered" | "On_The_Way" | "Pickup_Requested" | ... }
 */
const simulateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return next(ApiError.badRequest('status is required in the request body.'));

    const order = await Order.findById(req.params.id);
    if (!order) return next(ApiError.notFound('Order'));

    const PATHAO_STATUS_LABELS = {
      Pickup_Requested: 'Pickup Requested',
      On_The_Way:       'In Transit',
      Delivered:        'Delivered',
      Partial_Delivery: 'Partial Delivery',
      Return_In_Transit: 'Returning',
      Returned:         'Returned to Seller',
    };

    const label = PATHAO_STATUS_LABELS[status] || status;
    order.courierStatus = label;
    order.courierStatusHistory.push({ status: label, timestamp: new Date() });

    // If simulating Delivered, do the full escrow transition
    if (status === 'Delivered' && order.escrowStatus === 'SHIPPED') {
      const releaseDate = new Date();
      releaseDate.setHours(releaseDate.getHours() + 24); // 24-hour window
      const adminActor = { _id: req.user._id, role: 'admin' };
      order.transitionEscrow('DELIVERED', adminActor, `Admin simulated Pathao status: ${status}`);
      order.escrowReleaseDate = releaseDate;
    }

    await order.save();

    return res.status(200).json({
      status: 'success',
      message: `Simulated Pathao status: "${label}"`,
      data: { courierStatus: order.courierStatus, escrowStatus: order.escrowStatus },
    });
  } catch (err) {
    next(err);
  }
};

// Keep old simulateDelivery as an alias for backward compat
const simulateDelivery = (req, res, next) => {
  req.body.status = 'Delivered';
  return simulateStatus(req, res, next);
};

module.exports = {
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
};

