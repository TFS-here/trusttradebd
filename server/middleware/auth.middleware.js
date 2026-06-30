const { verifyToken } = require('../utils/generateToken');
const ApiError = require('../utils/apiError');
const User = require('../models/User.model');

/**
 * protect
 * ────────────────────────────────────────────────────────────────
 * Verifies the JWT from the Authorization header, hydrates req.user,
 * and blocks blocked/inactive accounts from making any request.
 *
 * Expected header: Authorization: Bearer <token>
 */
const protect = async (req, res, next) => {
  try {
    // 1. Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('No token provided. Please log in.'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) return next(ApiError.unauthorized('Malformed token.'));

    // 2. Verify signature + expiry
    const decoded = verifyToken(token);

    // 3. Check user still exists (handles deleted accounts)
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user) {
      return next(ApiError.unauthorized('Account no longer exists.'));
    }

    // 4. Check account status
    if (user.isBlocked) {
      return next(
        ApiError.forbidden(
          `Your account has been suspended${user.blockedReason ? ': ' + user.blockedReason : '.'}`
        )
      );
    }

    if (!user.isActive) {
      return next(ApiError.forbidden('Your account is inactive. Contact support.'));
    }

    // 5. Check if password changed after token was issued
    //    (invalidates tokens from before a password reset)
    if (user.changedPasswordAfter(decoded.iat)) {
      return next(ApiError.unauthorized('Password was recently changed. Please log in again.'));
    }

    // 6. Attach user to request (without sensitive fields)
    req.user = user;
    next();
  } catch (err) {
    next(err); // JWT errors bubble up to global error handler
  }
};

module.exports = { protect };
