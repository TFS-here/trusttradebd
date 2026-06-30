const express = require('express');
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
  verifyEmail,
  resendOtp,
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// ── Public routes ─────────────────────────────────────────────────
// Note: /api/auth already has a stricter authLimiter applied in server.js
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOtp);

// ── Protected routes ──────────────────────────────────────────────
router.use(protect); // All routes below require a valid JWT

router.get('/me', getMe);
router.put('/update-profile', updateProfile);
router.put('/change-password', changePassword);
router.post('/logout', logout);

module.exports = router;
