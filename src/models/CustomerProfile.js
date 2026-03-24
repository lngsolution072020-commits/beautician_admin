const mongoose = require('mongoose');

const customerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    defaultAddress: {
      type: String,
      trim: true
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City'
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    /** Average rating from beauticians (updated when beautician submits rating) */
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('CustomerProfile', customerProfileSchema);

