const mongoose = require('mongoose');
const { APPOINTMENT_STATUS } = require('../utils/constants');

const appointmentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    beautician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    preferredBeautician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor'
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    scheduledAt: {
      type: Date,
      required: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        index: '2dsphere'
      }
    },
    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.PENDING
    },
    notes: {
      type: String,
      trim: true
    },
    price: {
      type: Number,
      required: true
    },
    paymentMode: {
      type: String,
      enum: ['online', 'cod', 'wallet'],
      default: 'online'
    },
    startedAt: Date,
    completedAt: Date,
    /** Single-use code customer shows to beautician to begin service (plain, short-lived). */
    serviceStartOtp: {
      type: String,
      default: null
    },
    serviceStartOtpExpiresAt: {
      type: Date,
      default: null
    },
    /** When the current beautician's accept window ends (cascade to next if still pending). */
    offerExpiresAt: {
      type: Date,
      default: null
    },
    /** Beauticians who already received this offer (declined or timed out). */
    passedBeauticians: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    /** Customer rates beautician (mandatory after completion) */
    ratingFromCustomer: {
      stars: { type: Number, min: 1, max: 5 },
      comment: { type: String, trim: true, maxlength: 500 },
      createdAt: { type: Date }
    },
    /** Beautician rates customer (mandatory after completion) */
    ratingFromBeautician: {
      stars: { type: Number, min: 1, max: 5 },
      comment: { type: String, trim: true, maxlength: 500 },
      createdAt: { type: Date }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Appointment', appointmentSchema);

