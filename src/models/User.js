const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../utils/constants');

const userSchema = new mongoose.Schema(
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
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City'
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor'
    },
    beauticianProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BeauticianProfile'
    },
    customerProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerProfile'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    fcmToken: {
      type: String,
      default: null
    },
    /** Stored filename under uploads/profiles (see auth profile-image upload) */
    profileImage: {
      type: String,
      trim: true,
      default: ''
    },
    /** Unique code this user shares with others (customers & beauticians). */
    referralCode: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
      maxlength: 16
    },
    /** User who referred this account (optional). */
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    /** List of permissions for sub_admin. Example: ['dashboard_view', 'vendors_edit'] */
    permissions: [{
      type: String,
      trim: true
    }]
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function ensureReferralCode(next) {
  try {
    if (this.isNew && !this.referralCode) {
      const { generateUniqueReferralCode } = require('../utils/referralCode');
      this.referralCode = await generateUniqueReferralCode();
    }
    next();
  } catch (e) {
    next(e);
  }
});

// Hash password before save
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare plain password with hashed password
userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

