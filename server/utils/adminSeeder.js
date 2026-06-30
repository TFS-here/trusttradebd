/**
 * Admin Seeder
 * ─────────────────────────────────────────────────────────────────
 * Creates the initial admin account from environment variables.
 * Safe to run multiple times — idempotent (skips if admin exists).
 *
 * Usage:
 *   node utils/adminSeeder.js
 *
 * Required env vars:
 *   ADMIN_SEED_EMAIL     e.g. admin@trusttrade.bd
 *   ADMIN_SEED_PASSWORD  e.g. Admin@123!
 *   MONGO_URI
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');

const seed = async () => {
  const email    = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name     = process.env.ADMIN_SEED_NAME || 'Super Admin';

  if (!email || !password) {
    console.error('❌  ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  Connected to MongoDB');

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.role !== 'admin') {
        // Promote an existing non-admin account (edge case)
        existing.role = 'admin';
        await existing.save();
        console.log(`⬆️   Promoted existing account ${email} to admin.`);
      } else {
        console.log(`ℹ️   Admin account ${email} already exists. Nothing to do.`);
      }
      await mongoose.disconnect();
      return;
    }

    await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'admin',
      isActive: true,
      isBlocked: false,
    });

    console.log(`✅  Admin account created: ${email}`);
    console.log('⚠️   Change the password immediately after first login.');
  } catch (err) {
    console.error('❌  Seeder failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

seed();
