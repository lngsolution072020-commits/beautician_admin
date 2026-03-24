const express = require('express');
const customerController = require('../controllers/customer.controller');
const validate = require('../middlewares/requestValidator');
const customerValidation = require('../validations/customer.validation');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// All customer routes require customer role
router.use(authMiddleware, roleMiddleware(ROLES.CUSTOMER));

// Banners & Categories (for home)
router.get('/banners', customerController.getBanners);
router.get('/categories', customerController.getCategories);

// Services
router.get('/services', validate(customerValidation.getServices), customerController.getServices);
router.get('/services/:id', validate(customerValidation.serviceIdParam), customerController.getServiceById);

// Booking
router.post('/appointments', validate(customerValidation.createAppointment), customerController.createAppointment);
router.get('/appointments', validate(customerValidation.getAppointments), customerController.getAppointments);
router.get('/appointments/:id', validate(customerValidation.appointmentIdParam), customerController.getAppointmentById);
router.put('/appointments/:id/cancel', validate(customerValidation.cancelAppointment), customerController.cancelAppointment);

// Tracking
router.get('/track/:appointmentId', validate(customerValidation.trackAppointment), customerController.trackAppointment);

// Payments
router.post('/payment/initiate', validate(customerValidation.initiatePayment), customerController.initiatePayment);
router.post('/payment/verify', validate(customerValidation.verifyPayment), customerController.verifyPayment);
router.get('/invoices', validate(customerValidation.getInvoices), customerController.getInvoices);

module.exports = router;

