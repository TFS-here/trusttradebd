const ApiError = require('../utils/apiError');

/**
 * Global error-handling middleware.
 * Registered last in server.js as app.use(errorHandler).
 *
 * Normalises all error types into a consistent JSON response shape:
 *   { status, message, [errors] }
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // ── Log non-operational (programmer) errors in full ────────────
  if (!err.isOperational) {
    console.error('💥  UNHANDLED ERROR:', {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }

  // ── Mongoose: validation error ────────────────────────────────
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      status: 'fail',
      message: 'Validation failed.',
      errors,
    });
  }

  // ── Mongoose: duplicate key ───────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field];
    return res.status(409).json({
      status: 'fail',
      message: `${field} '${value}' is already in use. Please choose another.`,
    });
  }

  // ── Mongoose: bad ObjectId ────────────────────────────────────
  if (err.name === 'CastError') {
    return res.status(400).json({
      status: 'fail',
      message: `Invalid ID format for field '${err.path}'.`,
    });
  }

  // ── JWT errors ────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid token. Please log in again.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Your session has expired. Please log in again.',
    });
  }

  // ── Operational (ApiError) ────────────────────────────────────
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      ...(err.errors?.length > 0 && { errors: err.errors }),
    });
  }

  // ── Unknown / programmer error ────────────────────────────────
  return res.status(500).json({
    status: 'error',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Something went wrong. Please try again later.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
