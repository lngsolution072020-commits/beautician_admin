const mongoose = require('mongoose');

/** One row per referred customer — credits applied on first completed booking (idempotent). */
const referralPayoutSchema = new mongoose.Schema(
  {
    referee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true
    },
    customerReward: { type: Number, default: 0, min: 0 },
    referrerReward: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ReferralPayout', referralPayoutSchema);
