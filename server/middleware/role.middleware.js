const ApiError = require('../utils/apiError');

/**
 * roleGuard(...roles)
 * ────────────────────────────────────────────────────────────────
 * Factory that returns a middleware restricting access to the
 * specified roles. Must be used AFTER protect middleware so
 * req.user is guaranteed to be populated.
 *
 * Usage:
 *   router.delete('/users/:id', protect, roleGuard('admin'), deleteUser);
 *   router.post('/products',    protect, roleGuard('seller', 'admin'), createProduct);
 */
const roleGuard = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. This action requires one of: [${roles.join(', ')}]. ` +
            `Your role: ${req.user.role}.`
        )
      );
    }

    next();
  };
};

/**
 * isSelfOrAdmin
 * ────────────────────────────────────────────────────────────────
 * Allows access if the authenticated user is requesting their own
 * resource OR is an admin. Useful for profile update/delete routes.
 *
 * Expects the route param to be :userId or :id.
 *
 * Usage:
 *   router.put('/users/:userId', protect, isSelfOrAdmin, updateUser);
 */
const isSelfOrAdmin = (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());

  const targetId = req.params.userId || req.params.id;
  const isSelf = req.user._id.toString() === targetId;
  const isAdmin = req.user.role === 'admin';

  if (!isSelf && !isAdmin) {
    return next(ApiError.forbidden('You can only modify your own account.'));
  }

  next();
};

module.exports = { roleGuard, isSelfOrAdmin };
