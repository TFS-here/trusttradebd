const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const ROLES = ['buyer', 'seller', 'admin'];

const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters.'],
      maxlength: [60, 'Name must not exceed 60 characters.'],
    },

    email: {
      type: String,
      required: [true, 'Email is required.'],
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => validator.isEmail(v),
        message: 'Please provide a valid email address.',
      },
    },

    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [8, 'Password must be at least 8 characters.'],
      select: false, // Never returned in queries by default
    },

    phone: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || validator.isMobilePhone(v, 'any'),
        message: 'Please provide a valid phone number.',
      },
    },

    avatar: {
      type: String,
      default: '',
    },

    // ── Role & Status ─────────────────────────────────────────────
    role: {
      type: String,
      enum: {
        values: ROLES,
        message: `Role must be one of: ${ROLES.join(', ')}.`,
      },
      default: 'buyer',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    blockedReason: {
      type: String,
      default: '',
    },

    blockedAt: {
      type: Date,
    },

    // ── Wallet ────────────────────────────────────────────────────
    wallet: {
      balance: {
        type: Number,
        default: 0,
        min: [0, 'Wallet balance cannot be negative.'],
      },
      // Balance currently held in escrow across all active orders
      escrowBalance: {
        type: Number,
        default: 0,
        min: [0, 'Escrow balance cannot be negative.'],
      },
    },

    // ── Seller profile (populated if role === seller) ─────────────
    sellerProfile: {
      shopName: { type: String, trim: true, default: '' },
      shopDescription: { type: String, trim: true, default: '' },
      totalSales: { type: Number, default: 0 },
      rating: { type: Number, default: 0, min: 0, max: 5 },
      reviewCount: { type: Number, default: 0 },
    },

    // ── Email verification ────────────────────────────────────────
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifyOtp: {
      type: String,
      select: false, // Never returned in queries by default
    },
    emailVerifyExpires: {
      type: Date,
      select: false,
    },

    // ── Password reset (future) ───────────────────────────────────
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true, // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isBlocked: 1 });
userSchema.index({ createdAt: -1 });

// ── Virtual: available balance (balance not locked in escrow) ─────
userSchema.virtual('availableBalance').get(function () {
  return parseFloat((this.wallet.balance - this.wallet.escrowBalance).toFixed(2));
});

// ── Pre-save: hash password ───────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);

  // Track password change time for JWT invalidation logic
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000;
  }

  next();
});

// ── Instance method: compare passwords ───────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method: check if password changed after JWT issued ───
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedAt = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedAt;
  }
  return false;
};

// ── Static: safe public fields (never expose password/tokens) ─────
userSchema.statics.publicFields = function () {
  return '-password -passwordResetToken -passwordResetExpires -emailVerifyOtp -emailVerifyExpires -__v';
};

const User = mongoose.model('User', userSchema);
module.exports = User;
