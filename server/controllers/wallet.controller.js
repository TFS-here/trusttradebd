const mongoose = require('mongoose');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const ApiError = require('../utils/apiError');
const SSLCommerzPayment = require('sslcommerz-lts');

const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWD;
const is_live = process.env.SSLC_IS_SANDBOX !== 'true';

const API_URL = process.env.API_URL || 'http://localhost:5000';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

/**
 * GET /api/wallet/balance
 * Returns the authenticated user's wallet state.
 */
const getBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('wallet name email');
    if (!user) return next(ApiError.notFound('User'));

    const available = parseFloat(
      (user.wallet.balance - user.wallet.escrowBalance).toFixed(2)
    );

    return res.status(200).json({
      status: 'success',
      data: {
        wallet: {
          balance: user.wallet.balance,
          escrowBalance: user.wallet.escrowBalance,
          availableBalance: available,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/wallet/deposit
 * Initiates an SSLCommerz payment session for depositing funds.
 *
 * Max deposit: ৳100,000 per transaction.
 */
const deposit = async (req, res, next) => {
  try {
    const { amount } = req.body;

    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      return next(ApiError.badRequest('Amount must be a positive number.'));
    }

    if (parsed > 100_000) {
      return next(ApiError.badRequest('Maximum single deposit is ৳1,00,000.'));
    }

    const rounded = parseFloat(parsed.toFixed(2));
    const tran_id = `TXN_${Date.now()}_${req.user._id}`;

    const data = {
      total_amount: rounded,
      currency: 'BDT',
      tran_id: tran_id,
      success_url: `${API_URL}/api/wallet/deposit/success`,
      fail_url: `${API_URL}/api/wallet/deposit/fail`,
      cancel_url: `${API_URL}/api/wallet/deposit/cancel`,
      ipn_url: `${API_URL}/api/wallet/deposit/ipn`, // IPN not strictly necessary with success_url validation, but good practice
      shipping_method: 'No',
      product_name: 'Wallet Deposit',
      product_category: 'Finance',
      product_profile: 'general',
      cus_name: req.user.name || 'User',
      cus_email: req.user.email || 'user@example.com',
      cus_add1: 'Dhaka',
      cus_add2: 'Dhaka',
      cus_city: 'Dhaka',
      cus_state: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: req.user.phone || '01700000000',
      cus_fax: '01700000000',
      ship_name: req.user.name || 'User',
      ship_add1: 'Dhaka',
      ship_add2: 'Dhaka',
      ship_city: 'Dhaka',
      ship_state: 'Dhaka',
      ship_postcode: 1000,
      ship_country: 'Bangladesh',
      value_a: req.user._id.toString(), // Pass user ID
      value_b: rounded.toString()       // Pass amount
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    
    sslcz.init(data).then(apiResponse => {
      // Redirect the user to payment gateway
      if (apiResponse?.GatewayPageURL) {
        return res.status(200).json({ 
          status: 'success', 
          data: { GatewayPageURL: apiResponse.GatewayPageURL } 
        });
      } else {
        return next(ApiError.internal('Failed to generate payment gateway URL.'));
      }
    }).catch(err => {
      console.error('SSLCommerz Init Error:', err);
      return next(ApiError.internal('Payment gateway initialization failed.'));
    });

  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/wallet/deposit/success
 * Public callback from SSLCommerz. Validates transaction and updates wallet.
 */
const depositSuccess = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { tran_id, val_id, amount, status, value_a, value_b } = req.body;
    
    // Double check with SSLCommerz to prevent spoofing
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const validationResponse = await sslcz.transactionQueryByTransactionId({ tran_id });
    
    const isValid = validationResponse && 
                   validationResponse.element && 
                   validationResponse.element.length > 0 &&
                   (validationResponse.element[0].status === 'VALID' || validationResponse.element[0].status === 'VALIDATED');

    if (!isValid) {
      await session.abortTransaction();
      return res.redirect(`${CLIENT_URL}/wallet?payment=failed`);
    }

    const userId = value_a;
    const depositAmount = parseFloat(value_b);

    // Idempotency: Check if this transaction was already processed
    const existing = await Transaction.findOne({ description: { $regex: tran_id } });
    if (existing) {
      await session.abortTransaction();
      // Already processed, redirect to success
      return res.redirect(`${CLIENT_URL}/wallet?payment=success`);
    }

    // Process the deposit
    await Transaction.record(session, {
      userId: userId,
      type: 'DEPOSIT',
      amount: depositAmount,
      walletField: 'balance',
      operation: 'increment',
      initiatedBy: userId,
      description: `Wallet top-up of ৳${depositAmount} (TXN: ${tran_id})`,
    });

    await session.commitTransaction();
    return res.redirect(`${CLIENT_URL}/wallet?payment=success`);

  } catch (err) {
    await session.abortTransaction();
    console.error("Deposit Success Processing Error:", err);
    return res.redirect(`${CLIENT_URL}/wallet?payment=failed`);
  } finally {
    session.endSession();
  }
};

/**
 * POST /api/wallet/deposit/fail
 */
const depositFail = (req, res) => {
  return res.redirect(`${CLIENT_URL}/wallet?payment=failed`);
};

/**
 * POST /api/wallet/deposit/cancel
 */
const depositCancel = (req, res) => {
  return res.redirect(`${CLIENT_URL}/wallet?payment=failed`);
};


/**
 * GET /api/wallet/transactions
 * Paginated transaction history for the authenticated user.
 */
const getTransactions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };

    // Optional filter by type
    if (req.query.type) {
      filter.type = req.query.type.toUpperCase();
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('order', 'escrowStatus totalAmount items'),
      Transaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: 'success',
      data: {
        transactions,
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
 * POST /api/wallet/withdraw
 * Deducts funds from available balance (not escrow).
 * Max withdrawal: ৳100,000 per transaction.
 */
const withdraw = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { amount } = req.body;

    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      await session.abortTransaction();
      return next(ApiError.badRequest('Amount must be a positive number.'));
    }

    if (parsed > 100_000) {
      await session.abortTransaction();
      return next(ApiError.badRequest('Maximum single withdrawal is ৳1,00,000.'));
    }

    const rounded = parseFloat(parsed.toFixed(2));

    // Transaction.record checks balance and throws if insufficient
    const { updatedUser } = await Transaction.record(session, {
      userId:      req.user._id,
      type:        'WITHDRAWAL',
      amount:      rounded,
      walletField: 'balance',
      operation:   'decrement',
      initiatedBy: req.user._id,
      description: `Wallet withdrawal of ৳${rounded}`,
    });

    await session.commitTransaction();

    return res.status(200).json({
      status:  'success',
      message: `৳${rounded} withdrawn from your wallet.`,
      data: {
        wallet: {
          balance:          updatedUser.wallet.balance,
          escrowBalance:    updatedUser.wallet.escrowBalance,
          availableBalance: parseFloat(
            (updatedUser.wallet.balance - updatedUser.wallet.escrowBalance).toFixed(2)
          ),
        },
      },
    });
  } catch (err) {
    await session.abortTransaction();
    // Catch "Insufficient balance" thrown by Transaction.record
    if (err.message?.includes('Insufficient')) {
      return next(ApiError.badRequest(err.message));
    }
    next(err);
  } finally {
    session.endSession();
  }
};

module.exports = { 
  getBalance, 
  deposit, 
  depositSuccess, 
  depositFail, 
  depositCancel, 
  withdraw, 
  getTransactions 
};
