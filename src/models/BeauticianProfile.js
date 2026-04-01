const mongoose = require('mongoose');

const beauticianProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor'
    },
    expertise: [
      {
        type: String,
        trim: true
      }
    ],
    experienceYears: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    documents: [
      {
        type: {
          type: String,
          enum: ['aadhar', 'pan', 'license', 'photo', 'selfie', 'experience', 'other'],
          default: 'other'
        },
        url: {
          type: String,
          trim: true
        },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending'
        },
        notes: {
          type: String,
          trim: true
        }
      }
    ],
    kycStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    /** Platform fee (% of service revenue), 0–100. Set per beautician in admin. */
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

module.exports = mongoose.model('BeauticianProfile', beauticianProfileSchema);

