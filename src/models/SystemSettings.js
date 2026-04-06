const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema(
  {
    beauticianMaxDistanceKm: {
      type: Number,
      required: true,
      default: 10
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one document exists
systemSettingsSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('SystemSettings').countDocuments();
    if (count > 0) {
      return next(new Error('SystemSettings already exists. Only one document allowed.'));
    }
  }
  next();
});

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
