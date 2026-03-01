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
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('CustomerProfile', customerProfileSchema);

