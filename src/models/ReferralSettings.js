const mongoose = require('mongoose');

/**
 * Singleton app config for the referral program (one document in collection).
 */
const referralSettingsSchema = new mongoose.Schema(
  {
    isEnabled: {
      type: Boolean,
      default: false
    },
    /** Wallet/credit reward for the customer side when a referral qualifies (same currency as app, e.g. INR). */
    customerRewardAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    /** Wallet/credit reward for the beautician when a referral qualifies. */
    beauticianRewardAmount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ReferralSettings', referralSettingsSchema);
