const express = require('express');
const beauticianController = require('../controllers/beautician.controller');
const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/requestValidator');
const beauticianValidation = require('../validations/beautician.validation');
const authValidation = require('../validations/auth.validation');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { ROLES } = require('../utils/constants');
const { uploadKyc } = require('../config/multer');

const router = express.Router();

// All beautician routes require beautician role
router.use(authMiddleware, roleMiddleware(ROLES.BEAUTICIAN));

// Push: same handler as POST /auth/fcm-token (beautician JWT)
router.post('/fcm-token', validate(authValidation.fcmToken), authController.updateFcmToken);
router.put('/fcm-token', validate(authValidation.fcmToken), authController.updateFcmToken);

router.get('/commission', beauticianController.getMyCommission);

// Appointments (static paths before /:id)
router.get('/appointments/pending-ratings', beauticianController.getPendingRatings);
router.get('/appointments/:id', validate(beauticianValidation.appointmentIdParam), beauticianController.getAppointmentById);
router.get('/appointments', validate(beauticianValidation.getAppointments), beauticianController.getAppointments);
router.post(
  '/appointments/:id/rate-customer',
  validate(beauticianValidation.rateCustomer),
  beauticianController.rateCustomer
);
router.put('/appointments/:id/accept', validate(beauticianValidation.appointmentIdParam), beauticianController.acceptAppointment);
router.put('/appointments/:id/reject', validate(beauticianValidation.appointmentIdParam), beauticianController.rejectAppointment);
router.put('/appointments/:id/en-route', validate(beauticianValidation.appointmentIdParam), beauticianController.markEnRoute);
router.put('/appointments/:id/reached', validate(beauticianValidation.appointmentIdParam), beauticianController.markReached);
router.post(
  '/appointments/:id/verify-service-otp',
  validate(beauticianValidation.verifyServiceOtp),
  beauticianController.verifyServiceOtp
);
router.put('/appointments/:id/complete', validate(beauticianValidation.appointmentIdParam), beauticianController.completeAppointment);

// Location tracking
router.post('/location/update', validate(beauticianValidation.updateLocation), beauticianController.updateLocation);
router.get('/location/history', validate(beauticianValidation.locationHistory), beauticianController.getLocationHistory);

// Vendor inventory (for product usage modal when completing a service)
router.get('/inventory', beauticianController.getInventory);

// Product usage
router.post('/product-usage', validate(beauticianValidation.productUsage), beauticianController.recordProductUsage);

// Availability
router.post('/availability', validate(beauticianValidation.availability), beauticianController.setAvailability);

// KYC
router.get('/kyc', beauticianController.getKyc);
router.post('/kyc', validate(beauticianValidation.submitKyc), beauticianController.submitKyc);
router.post(
  '/kyc/upload',
  uploadKyc.fields([
    { name: 'aadhar', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'experience', maxCount: 1 }
  ]),
  beauticianController.uploadKycFiles
);

router.get('/referral', beauticianController.getReferral);

router.get('/bank-details', beauticianController.getBankDetails);
router.put('/bank-details', beauticianController.updateBankDetails);

module.exports = router;

