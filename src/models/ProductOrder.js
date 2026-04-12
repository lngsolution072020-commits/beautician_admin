const mongoose = require('mongoose');
const { PRODUCT_ORDER_STATUS } = require('../utils/constants');

const lineItemSchema = new mongoose.Schema(
  {
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true
    },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true }
  },
  { _id: false }
);

const productOrderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },
    items: {
      type: [lineItemSchema],
      validate: [(v) => Array.isArray(v) && v.length > 0, 'At least one line item']
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: undefined
      }
    },
    subTotal: {
      type: Number,
      required: true,
      default: 0
    },
    gstAmount: {
      type: Number,
      required: true,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMode: {
      type: String,
      enum: ['online', 'cod', 'wallet'],
      default: 'online'
    },
    status: {
      type: String,
      enum: Object.values(PRODUCT_ORDER_STATUS),
      default: PRODUCT_ORDER_STATUS.PENDING_PAYMENT
    }
  },
  { timestamps: true }
);

productOrderSchema.index({ customer: 1, createdAt: -1 });
productOrderSchema.index({ vendor: 1, createdAt: -1 });

module.exports = mongoose.model('ProductOrder', productOrderSchema);
