const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      trim: true,
      default: 'Other'
    },
    imageUrl: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    basePrice: {
      type: Number,
      required: true
    },
    durationMinutes: {
      type: Number,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Service', serviceSchema);

