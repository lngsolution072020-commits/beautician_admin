const Joi = require('joi');

const register = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(50).required(),
    phone: Joi.string().optional(),
    cityId: Joi.string().hex().length(24).optional(),
    referralCode: Joi.string().max(32).optional().allow('')
  })
};

const registerBeautician = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(50).required(),
    phone: Joi.string().required(),
    referralCode: Joi.string().max(32).optional().allow('')
    // City and vendor will be assigned later by admin; no raw IDs at signup
  })
};

const login = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(50).required()
  })
};

const refreshToken = {
  body: Joi.object({
    refreshToken: Joi.string().required()
  })
};

const updateProfile = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    phone: Joi.string().optional()
  })
};

const changePassword = {
  body: Joi.object({
    currentPassword: Joi.string().min(6).max(50).required(),
    newPassword: Joi.string().min(6).max(50).required()
  })
};

const deleteAccount = {
  body: Joi.object({
    password: Joi.string().min(6).max(50).required()
  })
};

const fcmToken = {
  body: Joi.object({
    /** Device FCM registration token (either field name is accepted) */
    token: Joi.string().trim().min(10).max(4096),
    fcmToken: Joi.string().trim().min(10).max(4096)
  })
    .or('token', 'fcmToken')
    .messages({
      'object.missing': 'Provide "token" or "fcmToken" (FCM registration string)'
    })
};

const sendOtp = {
  body: Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    fcmToken: Joi.string().min(10).optional(),
    role: Joi.string().valid('beautician', 'customer').optional()
  })
};

const verifyOtp = {
  body: Joi.object({
    phone: Joi.string().min(10).max(15).required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
    role: Joi.string().valid('beautician', 'customer').optional()
  })
};

const detectCityQuery = {
  query: Joi.object({
    lat: Joi.number().required(),
    lng: Joi.number().required()
  })
};

module.exports = {
  register,
  registerBeautician,
  login,
  refreshToken,
  updateProfile,
  changePassword,
  deleteAccount,
  fcmToken,
  sendOtp,
  verifyOtp,
  detectCityQuery
};

