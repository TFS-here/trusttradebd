/**
 * Custom operational error class.
 * Distinguishes expected errors (bad input, not found, forbidden)
 * from unexpected programmer errors (bugs, unhandled rejections).
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status code
   * @param {string} message     Human-readable error message
   * @param {Array}  [errors]    Optional field-level validation errors
   */
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Safe to expose to client
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }

  // ── Convenience factories ──────────────────────────────────────

  static badRequest(message, errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Not authenticated. Please log in.') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action.') {
    return new ApiError(403, message);
  }

  static notFound(resource = 'Resource') {
    return new ApiError(404, `${resource} not found.`);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }

  static internal(message = 'Something went wrong. Please try again later.') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
