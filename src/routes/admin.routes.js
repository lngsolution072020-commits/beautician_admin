const express = require('express');
const adminController = require('../controllers/admin.controller');
const validate = require('../middlewares/requestValidator');
const adminValidation = require('../validations/admin.validation');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { ROLES } = require('../utils/constants');
const { upload } = require('../config/multer');

const router = express.Router();

// Protect all admin routes & restrict to super admin
router.use(authMiddleware, roleMiddleware(ROLES.SUPER_ADMIN));

// Cities
router.post('/cities', validate(adminValidation.createCity), adminController.createCity);
router.get('/cities', validate(adminValidation.getCities), adminController.getCities);
router.put('/cities/:id', validate(adminValidation.updateCity), adminController.updateCity);
router.delete('/cities/:id', validate(adminValidation.updateCity), adminController.deleteCity);

// Vendors
router.post('/vendors', validate(adminValidation.createVendor), adminController.createVendor);
router.get('/vendors', validate(adminValidation.getVendors), adminController.getVendors);
router.get('/vendors/:id', validate(adminValidation.vendorIdParam), adminController.getVendorById);
router.put('/vendors/:id', validate(adminValidation.updateVendor), adminController.updateVendor);
router.delete('/vendors/:id', validate(adminValidation.vendorIdParam), adminController.deleteVendor);

// Services
router.post('/services', upload.single('image'), validate(adminValidation.createService), adminController.createService);
router.get('/services', validate(adminValidation.getServices), adminController.getServices);
router.put('/services/:id', upload.single('image'), validate(adminValidation.updateService), adminController.updateService);
router.delete('/services/:id', validate(adminValidation.serviceIdParam), adminController.deleteService);

// Beauticians
router.get('/beauticians', validate(adminValidation.getBeauticians), adminController.getBeauticians);
router.get('/beauticians/:id', validate(adminValidation.beauticianIdParam), adminController.getBeauticianById);
router.put('/beauticians/:id', validate(adminValidation.updateBeautician), adminController.updateBeautician);
router.post('/beauticians', validate(adminValidation.createBeautician), adminController.createBeautician);

// Users
router.get('/users', validate(adminValidation.getUsers), adminController.getUsers);
router.get('/users/:id', validate(adminValidation.userIdParam), adminController.getUserById);
router.put('/users/:id', validate(adminValidation.updateUser), adminController.updateUser);

// Alerts
router.get('/alerts', adminController.getAlerts);

// Dashboard & Reports
router.get('/dashboard', adminController.getDashboard);
router.get('/reports', validate(adminValidation.getReports), adminController.getReports);

module.exports = router;

