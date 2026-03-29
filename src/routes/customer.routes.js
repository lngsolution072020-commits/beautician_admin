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

router.get(
  '/beauticians/:id/summary',
  validate(customerValidation.beauticianUserIdParam),
  customerController.getBeauticianSummary
);

// Services
router.get('/services', validate(customerValidation.getServices), customerController.getServices);
router.get('/services/:id', validate(customerValidation.serviceIdParam), customerController.getServiceById);

// Shop (products from vendors in customer's city)
router.get('/shop/products', validate(customerValidation.getShopProducts), customerController.getShopProducts);
router.post('/shop/orders', validate(customerValidation.createProductOrder), customerController.createProductOrder);
router.get('/shop/orders', validate(customerValidation.getProductOrders), customerController.getProductOrders);
router.get('/shop/orders/:id', validate(customerValidation.productOrderIdParam), customerController.getProductOrderById);
router.put('/shop/orders/:id/cancel', validate(customerValidation.productOrderIdParam), customerController.cancelProductOrder);

// Booking
router.post('/appointments', validate(customerValidation.createAppointment), customerController.createAppointment);
router.get('/appointments', validate(customerValidation.getAppointments), customerController.getAppointments);
router.get('/appointments/pending-ratings', customerController.getPendingRatings);
router.post(
  '/appointments/:id/rate',
  validate(customerValidation.rateAppointment),
  customerController.rateAppointment
);
router.get('/appointments/:id', validate(customerValidation.appointmentIdParam), customerController.getAppointmentById);
router.put('/appointments/:id/cancel', validate(customerValidation.cancelAppointment), customerController.cancelAppointment);

// Tracking
router.get('/track/:appointmentId', validate(customerValidation.trackAppointment), customerController.trackAppointment);

// Payments
router.post('/payment/initiate', validate(customerValidation.initiatePayment), customerController.initiatePayment);
router.post('/payment/verify', validate(customerValidation.verifyPayment), customerController.verifyPayment);
router.post(
  '/wallet/recharge/initiate',
  validate(customerValidation.initiateWalletRecharge),
  customerController.initiateWalletRecharge
);
router.get('/invoices', validate(customerValidation.getInvoices), customerController.getInvoices);

router.get('/referral', customerController.getReferral);

module.exports = router;

