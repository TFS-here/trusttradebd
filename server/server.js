const env = require('./config/env');
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
const { startEscrowCronJob } = require('./controllers/courierEscrow.controller');

const app = express();

// ── Connect to Database ───────────────────────────────────────────
connectDB();

// ── Start Cron Jobs ───────────────────────────────────────────────
startEscrowCronJob();

// ── Security headers ──────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────
const rawOrigins = (env.CLIENT_URL || '*').split(',').map((url) => url.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      // Allow wildcard or matching origins
      if (rawOrigins.includes('*') || rawOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'idempotency-key', 'x-idempotency-key'],
  })
);

// ── Rate limiting ─────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
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

// ── Request logging (development only) ────────────────────────────
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Root endpoint (welcome & status ping) ────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: '🚀 TrustTrade BD API Server is running!',
    health: '/api/health',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'TrustTrade BD API is healthy.',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// ── Mount Routes ──────────────────────────────────────────────────
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
const PORT = env.PORT;

// Listen on all network interfaces in standalone / container / Render environments
// (Vercel serverless exports the app and injects process.env.VERCEL)
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TrustTrade BD server running on port ${PORT} [${env.NODE_ENV}]`);
  });
}

// Export the app for Vercel Serverless (if still used)
module.exports = app;

