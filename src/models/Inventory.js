const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    sku: {
      type: String,
      trim: true
    },
    quantity: {
      type: Number,
      default: 0
    },
    unit: {
      type: String,
      trim: true
    },
    costPrice: {
      type: Number
    },
    sellingPrice: {
      type: Number
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

module.exports = mongoose.model('Inventory', inventorySchema);

