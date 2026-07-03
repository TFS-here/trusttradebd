const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema({
  platformFeePercent: {
    type: Number,
    required: true,
    default: 2.5
  },
  // Add more settings here in the future if needed
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
