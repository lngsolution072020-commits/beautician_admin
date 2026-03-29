const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../utils/constants');

const paymentSchema = new mongoose.Schema(
  {
    paymentType: {
      type: String,
      enum: ['appointment', 'wallet_recharge', 'product_order'],
      default: 'appointment'
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null
    },
    productOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductOrder',
      default: null
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    provider: {
      type: String,
      default: 'razorpay'
    },
    providerOrderId: String,
    providerPaymentId: String,
    providerSignature: String,
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Payment', paymentSchema);

