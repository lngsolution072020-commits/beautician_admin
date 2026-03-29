const express = require('express');
const beauticianController = require('../controllers/beautician.controller');
const validate = require('../middlewares/requestValidator');
const beauticianValidation = require('../validations/beautician.validation');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { ROLES } = require('../utils/constants');
const { uploadKyc } = require('../config/multer');

const router = express.Router();

// All beautician routes require beautician role
router.use(authMiddleware, roleMiddleware(ROLES.BEAUTICIAN));

// Appointments
router.get('/appointments', validate(beauticianValidation.getAppointments), beauticianController.getAppointments);
router.get('/appointments/pending-ratings', beauticianController.getPendingRatings);
router.post(
  '/appointments/:id/rate-customer',
  validate(beauticianValidation.rateCustomer),
  beauticianController.rateCustomer
);
router.put('/appointments/:id/accept', validate(beauticianValidation.appointmentIdParam), beauticianController.acceptAppointment);
router.put('/appointments/:id/reject', validate(beauticianValidation.appointmentIdParam), beauticianController.rejectAppointment);
router.put('/appointments/:id/start', validate(beauticianValidation.appointmentIdParam), beauticianController.startAppointment);
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

module.exports = router;

