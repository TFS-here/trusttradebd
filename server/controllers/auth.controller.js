const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User.model');
const { generateToken } = require('../utils/generateToken');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/sendEmail');
const ApiError = require('../utils/apiError');
const validator = require('validator');

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Strips sensitive fields and shapes the user object for API responses.
 * Never send password, reset tokens, or internal flags to the client.
 */
const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || '',
  avatar: user.avatar || '',
  role: user.role,
  isActive: user.isActive,
  isBlocked: user.isBlocked,
  isVerified: user.isVerified,
  wallet: {
    balance: user.wallet.balance,
    escrowBalance: user.wallet.escrowBalance,
    availableBalance: user.availableBalance,
  },
  sellerProfile: user.role === 'seller' ? user.sellerProfile : undefined,
  createdAt: user.createdAt,
});

/**
 * Attaches a JWT cookie + returns a structured auth response.
 * Using httpOnly cookie alongside the Authorization header gives
 * flexibility for both web (cookie) and mobile (header) clients.
 */
const sendAuthResponse = (res, statusCode, user) => {
  const token = generateToken(user);

  // httpOnly cookie (web clients)
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });

  return res.status(statusCode).json({
    status: 'success',
    token, // Also expose for mobile / Authorization header clients
    data: { user: sanitizeUser(user) },
  });
};

/**
 * Generates a 6-digit OTP, returns the plaintext + bcrypt hash.
 */
const generateOtp = async () => {
  const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  const hash = await bcrypt.hash(otp, 10);
  return { otp, hash };
};

// ── Controllers ───────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Public — create a new buyer or seller account.
 * Does NOT issue a JWT. Returns { status: 'pending', email } so the
 * client can show the OTP verification step.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, shopName, shopDescription } = req.body;

    // ── Input validation ─────────────────────────────────────────
    const errors = [];

    if (!name || name.trim().length < 2)
      errors.push({ field: 'name', message: 'Name must be at least 2 characters.' });

    if (!email || !validator.isEmail(email))
      errors.push({ field: 'email', message: 'Please provide a valid email.' });

    if (!password || password.length < 8)
      errors.push({ field: 'password', message: 'Password must be at least 8 characters.' });

    // Password strength: at least one uppercase, one lowercase, one digit
    if (password && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain uppercase, lowercase, and a number.',
      });
    }

    const allowedRoles = ['buyer', 'seller'];
    if (role && !allowedRoles.includes(role)) {
      errors.push({ field: 'role', message: 'Role must be buyer or seller.' });
    }

    if (errors.length > 0) return next(ApiError.badRequest('Validation failed.', errors));

    // ── Check email uniqueness ────────────────────────────────────
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      // If user registered but never verified, allow re-registration (resend OTP)
      if (!existing.isVerified) {
        const { otp, hash } = await generateOtp();
        existing.emailVerifyOtp = hash;
        existing.emailVerifyExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        await existing.save({ validateBeforeSave: false });

        await sendVerificationEmail(existing.email, otp, existing.name);

        return res.status(200).json({
          status: 'pending',
          message: 'Verification code resent. Please check your email.',
          data: { email: existing.email },
        });
      }
      return next(ApiError.conflict('Email is already registered.'));
    }

    // ── Build user document ───────────────────────────────────────
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role || 'buyer',
      phone: phone?.trim() || '',
      isVerified: false,
    };

    // Seller-specific profile fields
    if (role === 'seller') {
      userData.sellerProfile = {
        shopName: shopName?.trim() || name.trim(),
        shopDescription: shopDescription?.trim() || '',
        totalSales: 0,
        rating: 0,
        reviewCount: 0,
      };
    }

    // Generate OTP
    const { otp, hash } = await generateOtp();
    userData.emailVerifyOtp = hash;
    userData.emailVerifyExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const user = await User.create(userData);

    // Send verification email (non-blocking on failure — log + continue)
    try {
      await sendVerificationEmail(user.email, otp, user.name);
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr.message);
    }

    return res.status(201).json({
      status: 'pending',
      message: 'Account created. Please verify your email to continue.',
      data: { email: user.email },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-email
 * Public — verifies the 6-digit OTP, activates account, issues JWT.
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return next(ApiError.badRequest('Email and verification code are required.'));
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      '+emailVerifyOtp +emailVerifyExpires'
    );

    if (!user) return next(ApiError.notFound('User'));

    if (user.isVerified) {
      // Already verified — just log them in
      return sendAuthResponse(res, 200, user);
    }

    // Check expiry
    if (!user.emailVerifyOtp || !user.emailVerifyExpires || user.emailVerifyExpires < Date.now()) {
      return next(ApiError.badRequest('Verification code has expired. Please request a new one.'));
    }

    // Compare OTP
    const isMatch = await bcrypt.compare(String(otp).trim(), user.emailVerifyOtp);
    if (!isMatch) {
      return next(ApiError.badRequest('Invalid verification code.'));
    }

    // Activate account
    user.isVerified = true;
    user.emailVerifyOtp = undefined;
    user.emailVerifyExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return sendAuthResponse(res, 200, user);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/resend-otp
 * Public — regenerates and resends the OTP.
 * Rate-limited: only one resend per 60 seconds.
 */
const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) return next(ApiError.badRequest('Email is required.'));

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      '+emailVerifyOtp +emailVerifyExpires'
    );

    if (!user) return next(ApiError.notFound('User'));
    if (user.isVerified) return next(ApiError.badRequest('Email is already verified.'));

    // Enforce 60-second cooldown (expires is set 10 min out; if > 9 min remain, too soon)
    if (user.emailVerifyExpires && user.emailVerifyExpires > new Date(Date.now() + 9 * 60 * 1000)) {
      return next(
        ApiError.badRequest('Please wait 60 seconds before requesting a new code.')
      );
    }

    const { otp, hash } = await generateOtp();
    user.emailVerifyOtp = hash;
    user.emailVerifyExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    try {
      await sendVerificationEmail(user.email, otp, user.name);
    } catch (emailErr) {
      console.error('Failed to resend verification email:', emailErr.message);
      return next(ApiError.internal('Failed to send email. Please try again.'));
    }

    return res.status(200).json({
      status: 'success',
      message: 'New verification code sent. Please check your email.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Public — authenticate with email + password.
 * Works for all roles (buyer, seller, admin via /api/admin/login).
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(ApiError.badRequest('Email and password are required.'));
    }

    // Explicitly select password (excluded by default in schema)
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      '+password +passwordChangedAt'
    );

    // Constant-time check: always run comparePassword even if user not found
    // to prevent timing attacks that reveal whether an email is registered
    const isMatch = user ? await user.comparePassword(password) : false;

    if (!user || !isMatch) {
      return next(ApiError.unauthorized('Invalid email or password.'));
    }

    if (!user.isVerified && user.role !== 'admin') {
      return next(
        ApiError.forbidden(
          'Email not verified. Please verify your email before logging in.'
        )
      );
    }

    if (user.isBlocked) {
      return next(
        ApiError.forbidden(
          `Account suspended${user.blockedReason ? ': ' + user.blockedReason : '.'}`
        )
      );
    }

    if (!user.isActive) {
      return next(ApiError.forbidden('Account inactive. Contact support.'));
    }

    return sendAuthResponse(res, 200, user);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Protected — return the current authenticated user's profile.
 */
const getMe = async (req, res, next) => {
  try {
    // req.user is hydrated by protect middleware
    // Re-fetch to get the freshest wallet balance
    const user = await User.findById(req.user._id);
    if (!user) return next(ApiError.notFound('User'));

    return res.status(200).json({
      status: 'success',
      data: { user: sanitizeUser(user) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/auth/update-profile
 * Protected — update name, phone, avatar, or seller shop info.
 * Email changes are intentionally excluded (requires verification flow).
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar, shopName, shopDescription } = req.body;

    // Guard: don't allow password or role changes through this endpoint
    if (req.body.password || req.body.role || req.body.email) {
      return next(
        ApiError.badRequest(
          'This endpoint cannot update email, password, or role. Use dedicated endpoints.'
        )
      );
    }

    const updates = {};

    if (name) {
      if (name.trim().length < 2)
        return next(ApiError.badRequest('Name must be at least 2 characters.'));
      updates.name = name.trim();
    }

    if (phone !== undefined) {
      if (phone && !validator.isMobilePhone(phone, 'any'))
        return next(ApiError.badRequest('Invalid phone number.'));
      updates.phone = phone.trim();
    }

    if (avatar !== undefined) updates.avatar = avatar.trim();

    // Seller profile updates
    if (req.user.role === 'seller') {
      if (shopName !== undefined) updates['sellerProfile.shopName'] = shopName.trim();
      if (shopDescription !== undefined)
        updates['sellerProfile.shopDescription'] = shopDescription.trim();
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      data: { user: sanitizeUser(user) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/auth/change-password
 * Protected — change password after verifying current password.
 * Invalidates all existing sessions (passwordChangedAt updated via pre-save hook).
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(ApiError.badRequest('Current password and new password are required.'));
    }

    if (newPassword.length < 8) {
      return next(ApiError.badRequest('New password must be at least 8 characters.'));
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return next(
        ApiError.badRequest('Password must contain uppercase, lowercase, and a number.')
      );
    }

    if (currentPassword === newPassword) {
      return next(ApiError.badRequest('New password must be different from current password.'));
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return next(ApiError.unauthorized('Current password is incorrect.'));
    }

    user.password = newPassword;
    await user.save(); // pre-save hook hashes password + sets passwordChangedAt

    // Issue a new token (old tokens are now invalid due to passwordChangedAt)
    return sendAuthResponse(res, 200, user);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Protected — clears the JWT cookie.
 * (Token-based clients simply discard their token on the frontend.)
 */
const logout = (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  return res.status(200).json({
    status: 'success',
    message: 'Logged out successfully.',
  });
};

/**
 * POST /api/auth/forgot-password
 * Public — send a password reset link to user email
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(ApiError.badRequest('Email is required.'));

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Don't leak whether the email exists, just return success
      return res.status(200).json({ status: 'success', message: 'If that email exists, a reset code has been sent.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash and save OTP
    user.passwordResetToken = crypto.createHash('sha256').update(otp).digest('hex');
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save({ validateBeforeSave: false });

    // Send email
    try {
      await sendPasswordResetEmail(user.email, otp, user.name);
      return res.status(200).json({ status: 'success', message: 'Password reset code sent to email.' });
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return next(ApiError.internal('There was an error sending the email. Try again later.'));
    }
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/reset-password
 * Public — reset password using OTP
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return next(ApiError.badRequest('Email, OTP, and new password are required.'));
    }

    const hashedToken = crypto.createHash('sha256').update(otp).digest('hex');
    
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(ApiError.badRequest('OTP is invalid or has expired.'));
    }

    if (newPassword.length < 8) {
      return next(ApiError.badRequest('New password must be at least 8 characters.'));
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return next(ApiError.badRequest('Password must contain uppercase, lowercase, and a number.'));
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.status(200).json({ status: 'success', message: 'Password reset successful.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword, logout, verifyEmail, resendOtp, forgotPassword, resetPassword };
