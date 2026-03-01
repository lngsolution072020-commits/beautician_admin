const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const CustomerProfile = require('../models/CustomerProfile');
const ApiError = require('../utils/apiError');
const { ROLES } = require('../utils/constants');
const { sendFCMToToken } = require('./notification.service');

// In-memory OTP store: phone (normalized) -> { otp, expiresAt }
const otpStore = new Map();
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(2);
  return digits;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Generate access and refresh tokens for a user
const generateTokens = (user) => {
  const payload = {
    sub: user.id,
    role: user.role
  };

  const accessToken = jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiry
  });
  const refreshToken = jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiry
  });

  return { accessToken, refreshToken };
};

// Register a new customer user
const register = async ({ name, email, password, phone, cityId }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(400, 'Email already in use');
  }

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: 'customer',
    city: cityId
  });

  const customerProfile = await CustomerProfile.create({
    user: user.id,
    city: cityId
  });

  user.customerProfile = customerProfile.id;
  await user.save();

  const tokens = generateTokens(user);

  return { user, tokens };
};

// Authenticate user credentials and issue tokens
const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const tokens = generateTokens(user);
  return { user, tokens };
};

// Verify refresh token and issue a new access token pair
const refreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, env.jwt.refreshSecret);
    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      throw new ApiError(401, 'User not found or inactive');
    }
    const tokens = generateTokens(user);
    return { user, tokens };
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }
};

// In a stateless JWT setup, logout is handled client-side by discarding tokens.
const logout = async () => true;

// Get current authenticated user profile
const getProfile = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return user;
};

// Update basic profile fields
const updateProfile = async (userId, payload) => {
  const allowedFields = ['name', 'phone'];
  const update = {};
  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) {
      update[field] = payload[field];
    }
  });

  const user = await User.findByIdAndUpdate(userId, update, {
    new: true
  }).select('-password');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
};

// Register FCM token for push notifications
const updateFcmToken = async (userId, token) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { fcmToken: token },
    { new: true }
  ).select('-password');
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

// Change password for authenticated user
const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  return true;
};

// Send OTP to phone (beautician or customer login). If fcmToken provided, OTP is sent via push.
const sendOtp = async (phone, fcmToken = null, role = 'beautician') => {
  const normalized = normalizePhone(phone);
  if (normalized.length < 10) {
    throw new ApiError(400, 'Invalid phone number');
  }

  const targetRole = role === 'customer' ? ROLES.CUSTOMER : ROLES.BEAUTICIAN;
  const phoneVariants = [
    normalized,
    `+91${normalized}`,
    `91${normalized}`,
    `0${normalized}`,
    normalized.replace(/^0+/, '')
  ].filter(Boolean);
  const user = await User.findOne({
    phone: { $in: phoneVariants },
    role: targetRole,
    isActive: true
  });
  if (!user) {
    const msg = targetRole === ROLES.BEAUTICIAN
      ? 'No beautician account found with this number. Please contact your vendor.'
      : 'No account found with this number. Please sign up first.';
    throw new ApiError(404, msg);
  }

  const otp = generateOtp();
  otpStore.set(normalized, { otp, expiresAt: Date.now() + OTP_EXPIRY_MS });

  const sentViaPush = !!(
    fcmToken &&
    (await sendFCMToToken(fcmToken, {
      title: 'GlamGo OTP',
      body: `Your login OTP is ${otp}. Valid for 10 minutes.`,
      data: { otp, type: 'otp' }
    }))
  );

  if (!sentViaPush) {
    if (process.env.NODE_ENV !== 'production' || !process.env.TWILIO_ACCOUNT_SID) {
      // eslint-disable-next-line no-console
      console.log(`[OTP] ${normalized} => ${otp} (valid 10 min)`);
    }
  }

  return { sent: true };
};

// Verify OTP and login (beautician)
const verifyOtp = async (phone, otp) => {
  const normalized = normalizePhone(phone);
  const stored = otpStore.get(normalized);
  if (!stored) {
    throw new ApiError(400, 'OTP expired or not sent. Please request again.');
  }
  if (stored.expiresAt < Date.now()) {
    otpStore.delete(normalized);
    throw new ApiError(400, 'OTP expired. Please request a new one.');
  }
  if (stored.otp !== otp) {
    throw new ApiError(401, 'Invalid OTP');
  }
  otpStore.delete(normalized);

  const phoneVariants = [
    normalized,
    `+91${normalized}`,
    `91${normalized}`,
    `0${normalized}`,
    normalized.replace(/^0+/, '')
  ].filter(Boolean);
  const user = await User.findOne({
    phone: { $in: phoneVariants },
    role: { $in: [ROLES.BEAUTICIAN, ROLES.CUSTOMER] },
    isActive: true
  }).select('-password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const tokens = generateTokens(user);
  return { user, tokens };
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  updateFcmToken,
  sendOtp,
  verifyOtp
};

