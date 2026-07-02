require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const ApiError = require('./utils/apiError');
const { errorHandler } = require('./middleware/error.middleware');

// ── Route imports ─────────────────────────────────────────────────
const authRoutes    = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes   = require('./routes/order.routes');
const walletRoutes  = require('./routes/wallet.routes');
const reviewRoutes  = require('./routes/review.routes');
const adminRoutes   = require('./routes/admin.routes');
const qaRoutes      = require('./routes/qa.routes');
const uploadRoutes  = require('./routes/upload.routes');
const paymentRoutes = require('./routes/payment.routes');
const disputeRoutes = require('./routes/dispute.routes');


const chatRoutes = require('./routes/chat.routes');
const courierEscrowRoutes = require('./routes/courierEscrow.routes');

const app = express();

// ── Connect to Database ───────────────────────────────────────────
connectDB();

// ── Security headers ──────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'idempotency-key', 'x-idempotency-key'],
  })
);

// ── Rate limiting ─────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Too many requests from this IP. Please try again later.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    status: 'fail',
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
});

app.use('/api', limiter);
app.use('/api/auth', authLimiter);

// ── Body parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Sanitize against NoSQL injection ─────────────────────────────
app.use(mongoSanitize());

// ── HTTP request logger ───────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/wallet',   walletRoutes);
app.use('/api/reviews',  reviewRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/qa',       qaRoutes);
app.use('/api/upload',   uploadRoutes);
app.use('/api/payment',  paymentRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/v1/shipping', courierEscrowRoutes);
app.use('/api/chat',     chatRoutes);

// ── 404 handler ───────────────────────────────────────────────────
app.all('*', (req, res, next) => {
  next(ApiError.notFound(`Route ${req.originalUrl}`));
});

// ── Global error handler ──────────────────────────────────────────
app.use(errorHandler);

// ── Handle unhandled rejections & uncaught exceptions ─────────────
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION:', err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err.message);
  process.exit(1);
});

// ── Start server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Only listen when not in Vercel production environment
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 TrustTrade BD server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

// Export the app for Vercel Serverless
module.exports = app;

