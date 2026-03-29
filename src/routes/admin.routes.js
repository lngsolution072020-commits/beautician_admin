const express = require('express');
const adminController = require('../controllers/admin.controller');
const validate = require('../middlewares/requestValidator');
const adminValidation = require('../validations/admin.validation');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { attachVendorScope, superAdminOnly } = require('../middlewares/adminScopeMiddleware');
const { ROLES } = require('../utils/constants');
const { upload, uploadBanner, uploadCategory } = require('../config/multer');

const router = express.Router();

router.use(authMiddleware, roleMiddleware(ROLES.SUPER_ADMIN, ROLES.VENDOR), attachVendorScope);

// Cities — list readable by vendor panel (dropdowns); mutations super admin only
router.post('/cities', superAdminOnly, validate(adminValidation.createCity), adminController.createCity);
router.get('/cities', validate(adminValidation.getCities), adminController.getCities);
router.put('/cities/:id', superAdminOnly, validate(adminValidation.updateCity), adminController.updateCity);
router.delete('/cities/:id', superAdminOnly, validate(adminValidation.updateCity), adminController.deleteCity);

// Vendors — list/detail for vendor (scoped); mutations super admin only
router.post('/vendors', superAdminOnly, validate(adminValidation.createVendor), adminController.createVendor);
router.get('/vendors', validate(adminValidation.getVendors), adminController.getVendors);
router.get('/vendors/:id', validate(adminValidation.vendorIdParam), adminController.getVendorById);
router.put('/vendors/:id', superAdminOnly, validate(adminValidation.updateVendor), adminController.updateVendor);
router.delete('/vendors/:id', superAdminOnly, validate(adminValidation.vendorIdParam), adminController.deleteVendor);

// Banners — super admin only
router.post('/banners', superAdminOnly, uploadBanner.single('image'), validate(adminValidation.createBanner), adminController.createBanner);
router.get('/banners', superAdminOnly, validate(adminValidation.getBanners), adminController.getBanners);
router.put('/banners/:id', superAdminOnly, uploadBanner.single('image'), validate(adminValidation.updateBanner), adminController.updateBanner);
router.delete('/banners/:id', superAdminOnly, validate(adminValidation.bannerIdParam), adminController.deleteBanner);

// Categories — super admin only
router.post('/categories', superAdminOnly, uploadCategory.single('image'), validate(adminValidation.createCategory), adminController.createCategory);
router.get('/categories', superAdminOnly, validate(adminValidation.getCategories), adminController.getCategories);
router.put('/categories/:id', superAdminOnly, uploadCategory.single('image'), validate(adminValidation.updateCategory), adminController.updateCategory);
router.delete('/categories/:id', superAdminOnly, validate(adminValidation.categoryIdParam), adminController.deleteCategory);

// Services — super admin only
router.post('/services', superAdminOnly, upload.single('image'), validate(adminValidation.createService), adminController.createService);
router.get('/services', superAdminOnly, validate(adminValidation.getServices), adminController.getServices);
router.put('/services/:id', superAdminOnly, upload.single('image'), validate(adminValidation.updateService), adminController.updateService);
router.delete('/services/:id', superAdminOnly, validate(adminValidation.serviceIdParam), adminController.deleteService);

// Beauticians — vendor: read only in this panel
router.get('/beauticians', validate(adminValidation.getBeauticians), adminController.getBeauticians);
router.get('/beauticians/:id', validate(adminValidation.beauticianIdParam), adminController.getBeauticianById);
router.get('/beauticians/:id/live-location', validate(adminValidation.beauticianIdParam), adminController.getBeauticianLiveLocation);
router.put('/beauticians/:id', superAdminOnly, validate(adminValidation.updateBeautician), adminController.updateBeautician);
router.post('/beauticians', superAdminOnly, validate(adminValidation.createBeautician), adminController.createBeautician);

// Users — vendor: read only
router.get('/users', validate(adminValidation.getUsers), adminController.getUsers);
router.get('/users/:id', validate(adminValidation.userIdParam), adminController.getUserById);
router.put('/users/:id', superAdminOnly, validate(adminValidation.updateUser), adminController.updateUser);

// Alerts, payments, reports — allowed for vendor (scoped in service)
router.get('/alerts', adminController.getAlerts);
router.get('/payments', validate(adminValidation.getPayments), adminController.getPayments);

// Appointments — vendor: read only
router.get('/appointments', validate(adminValidation.getAppointments), adminController.getAppointments);
router.get('/appointments/:id', validate(adminValidation.appointmentIdParam), adminController.getAppointmentById);
router.put('/appointments/:id', superAdminOnly, validate(adminValidation.updateAppointment), adminController.updateAppointment);

// Dashboard & Reports
router.get('/dashboard', adminController.getDashboard);
router.get('/reports', validate(adminValidation.getReports), adminController.getReports);

module.exports = router;
