const express = require('express');
const beauticianController = require('../controllers/beautician.controller');
const validate = require('../middlewares/requestValidator');
const beauticianValidation = require('../validations/beautician.validation');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// All beautician routes require beautician role
router.use(authMiddleware, roleMiddleware(ROLES.BEAUTICIAN));

// Appointments
router.get('/appointments', validate(beauticianValidation.getAppointments), beauticianController.getAppointments);
router.put('/appointments/:id/accept', validate(beauticianValidation.appointmentIdParam), beauticianController.acceptAppointment);
router.put('/appointments/:id/reject', validate(beauticianValidation.appointmentIdParam), beauticianController.rejectAppointment);
router.put('/appointments/:id/start', validate(beauticianValidation.appointmentIdParam), beauticianController.startAppointment);
router.put('/appointments/:id/complete', validate(beauticianValidation.appointmentIdParam), beauticianController.completeAppointment);

// Location tracking
router.post('/location/update', validate(beauticianValidation.updateLocation), beauticianController.updateLocation);
router.get('/location/history', validate(beauticianValidation.locationHistory), beauticianController.getLocationHistory);

// Product usage
router.post('/product-usage', validate(beauticianValidation.productUsage), beauticianController.recordProductUsage);

// Availability
router.post('/availability', validate(beauticianValidation.availability), beauticianController.setAvailability);

module.exports = router;

