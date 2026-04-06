const express = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/requestValidator');
const authValidation = require('../validations/auth.validation');
const authMiddleware = require('../middlewares/authMiddleware');
const { uploadProfile } = require('../config/multer');

const router = express.Router();

// Public auth routes
router.post('/register', validate(authValidation.register), authController.register);
router.post('/register-beautician', validate(authValidation.registerBeautician), authController.registerBeautician);
router.post('/login', validate(authValidation.login), authController.login);
router.get('/cities', authController.listPublicCities);
router.get('/cities/detect', validate(authValidation.detectCityQuery), authController.detectCity);
router.get('/referral-settings', authController.getPublicReferralSettings);
router.get('/commission-settings', authController.getPublicCommissionSettings);
router.post('/send-otp', validate(authValidation.sendOtp), authController.sendOtp);
router.post('/verify-otp', validate(authValidation.verifyOtp), authController.verifyOtp);
router.post('/refresh-token', validate(authValidation.refreshToken), authController.refreshToken);

// Authenticated routes
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);
router.post(
  '/profile-image',
  authMiddleware,
  uploadProfile.single('image'),
  authController.uploadProfileImage
);
router.put('/update-profile', authMiddleware, validate(authValidation.updateProfile), authController.updateProfile);
router.post('/change-password', authMiddleware, validate(authValidation.changePassword), authController.changePassword);
router.post('/delete-account', authMiddleware, validate(authValidation.deleteAccount), authController.deleteAccount);
router.post('/fcm-token', authMiddleware, validate(authValidation.fcmToken), authController.updateFcmToken);
router.put('/fcm-token', authMiddleware, validate(authValidation.fcmToken), authController.updateFcmToken);

module.exports = router;

