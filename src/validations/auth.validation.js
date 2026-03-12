const Joi = require('joi');

const register = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(50).required(),
    phone: Joi.string().optional(),
    cityId: Joi.string().hex().length(24).optional()
  })
};

const registerBeautician = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(50).required(),
    phone: Joi.string().optional(),
    cityId: Joi.string().hex().length(24).optional(),
    vendorId: Joi.string().hex().length(24).optional(),
    documents: Joi.array()
      .items(
        Joi.object({
          type: Joi.string().valid('aadhar', 'pan', 'license', 'photo', 'other').optional(),
          url: Joi.string().uri().required()
        })
      )
      .optional()
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

const fcmToken = {
  body: Joi.object({
    token: Joi.string().min(10).required()
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

module.exports = {
  register,
  registerBeautician,
  login,
  refreshToken,
  updateProfile,
  changePassword,
  fcmToken,
  sendOtp,
  verifyOtp
};

