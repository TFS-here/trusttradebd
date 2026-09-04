const ApiError = require('../utils/apiError');

/**
 * Lightweight declarative request validation middleware.
 * Validates request payload against custom schema rules.
 *
 * @param {Function} validatorFn  Function receiving (req.body, req.query, req.params) and returning { error, value } or null
 * @returns {Function} Express middleware
 *
 * Example:
 * router.post('/orders', protect, validate(validatePlaceOrder), orderController.placeOrder);
 */
const validate = (validatorFn) => {
  return (req, res, next) => {
    try {
      const error = validatorFn(req.body, req.query, req.params);
      if (error) {
        return next(ApiError.badRequest(typeof error === 'string' ? error : error.message));
      }
      next();
    } catch (err) {
      next(ApiError.badRequest(`Validation error: ${err.message}`));
    }
  };
};

module.exports = { validate };
