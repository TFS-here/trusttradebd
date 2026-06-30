const mongoose = require('mongoose');

const connectDB = async () => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 3000;
  let attempts = 0;

  const connect = async () => {
    try {
      attempts += 1;
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        // Mongoose 8+ handles these internally, but explicit for clarity
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log(`✅  MongoDB connected: ${conn.connection.host} (attempt ${attempts})`);

      // ── Connection event listeners ──────────────────────────────
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB disconnected. Reconnecting…');
      });

      mongoose.connection.on('error', (err) => {
        console.error('❌  MongoDB connection error:', err.message);
      });
    } catch (err) {
      console.error(`❌  MongoDB connection failed (attempt ${attempts}/${MAX_RETRIES}): ${err.message}`);

      if (attempts < MAX_RETRIES) {
        console.log(`⏳  Retrying in ${RETRY_DELAY_MS / 1000}s…`);
        await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
        return connect();
      }

      console.error('💀  Max retries reached. Exiting process.');
      process.exit(1);
    }
  };

  await connect();
};

module.exports = connectDB;
