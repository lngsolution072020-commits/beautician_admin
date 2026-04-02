const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      required: true
    },
    address: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    /**
     * Vendor commission: % of each beautician's earnings (under this vendor) credited to the vendor.
     * Example: 15 means the vendor receives 15% of what their beauticians earn from completed services.
     * 0–100.
     */
    platformCommissionPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 10
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Vendor', vendorSchema);

