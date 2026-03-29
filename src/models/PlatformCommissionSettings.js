const mongoose = require('mongoose');

/**
 * Singleton: admin-defined platform commission rates (percent of relevant revenue).
 */
const platformCommissionSettingsSchema = new mongoose.Schema(
  {
    /** Percent (0–100) retained by the platform from beautician-side earnings (e.g. service appointments). */
    beauticianCommissionPercent: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    },
    /** Percent (0–100) retained by the platform from vendor-side revenue (e.g. product orders, salon share). */
    vendorCommissionPercent: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformCommissionSettings', platformCommissionSettingsSchema);
