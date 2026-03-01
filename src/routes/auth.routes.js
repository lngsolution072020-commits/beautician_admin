const express = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/requestValidator');
const authValidation = require('../validations/auth.validation');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// Public auth routes
router.post('/register', validate(authValidation.register), authController.register);
router.post('/login', validate(authValidation.login), authController.login);
router.post('/send-otp', validate(authValidation.sendOtp), authController.sendOtp);
router.post('/verify-otp', validate(authValidation.verifyOtp), authController.verifyOtp);
router.post('/refresh-token', validate(authValidation.refreshToken), authController.refreshToken);

// Authenticated routes
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/update-profile', authMiddleware, validate(authValidation.updateProfile), authController.updateProfile);
router.post('/change-password', authMiddleware, validate(authValidation.changePassword), authController.changePassword);
router.post('/fcm-token', authMiddleware, validate(authValidation.fcmToken), authController.updateFcmToken);

module.exports = router;

