const dotenv = require('dotenv');
dotenv.config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  
  // Database
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/trusttrade_bd',
  
  // Authentication / JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_key_change_in_production_min_32_chars',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Client & Server URLs
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  API_URL: process.env.API_URL || 'http://localhost:5000',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  
  // SSLCommerz Payment Gateway
  SSLC: {
    STORE_ID: process.env.SSLC_STORE_ID || '',
    STORE_PASSWD: process.env.SSLC_STORE_PASSWD || '',
    IS_SANDBOX: process.env.SSLC_IS_SANDBOX === 'true' || process.env.SSLCOMMERZ_IS_SANDBOX === 'true',
  },
  
  // Pathao Courier
  PATHAO: {
    BASE_URL: process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com',
    CLIENT_ID: process.env.PATHAO_CLIENT_ID || '',
    CLIENT_SECRET: process.env.PATHAO_CLIENT_SECRET || '',
    USERNAME: process.env.PATHAO_USERNAME || '',
    PASSWORD: process.env.PATHAO_PASSWORD || '',
    STORE_ID: process.env.PATHAO_STORE_ID || '',
  },
  
  // Cloudinary
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    API_KEY: process.env.CLOUDINARY_API_KEY || '',
    API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  },
  
  // Admin Seeder
  ADMIN_SEED: {
    EMAIL: process.env.ADMIN_SEED_EMAIL || 'admin@trusttrade.bd',
    PASSWORD: process.env.ADMIN_SEED_PASSWORD || 'Admin@Secure123!',
    NAME: process.env.ADMIN_SEED_NAME || 'Super Admin',
  },
};

// Validate critical variables in production
if (env.NODE_ENV === 'production') {
  const critical = ['MONGO_URI', 'JWT_SECRET'];
  const missing = critical.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`🚨 Fatal: Missing required production environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

module.exports = env;
