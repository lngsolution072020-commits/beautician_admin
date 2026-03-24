const mongoose = require('mongoose');

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true,
      default: 'India'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    /** Center point from Google Places when city is created (for matching user GPS to city) */
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    },
    googlePlaceId: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('City', citySchema);

