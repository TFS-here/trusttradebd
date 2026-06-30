const jwt = require('jsonwebtoken');

/**
 * Generates a signed JWT for the given user document.
 * Payload is intentionally minimal — never include sensitive data.
 *
 * @param  {Object} user  Mongoose User document
 * @returns {string}      Signed JWT string
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'trusttrade-bd',
    }
  );
};

/**
 * Verifies and decodes a JWT string.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 *
 * @param  {string} token
 * @returns {Object} decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET, {
    issuer: 'trusttrade-bd',
  });
};

module.exports = { generateToken, verifyToken };
