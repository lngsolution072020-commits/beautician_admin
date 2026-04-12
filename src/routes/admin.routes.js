const express = require('express');
const adminController = require('../controllers/admin.controller');
const validate = require('../middlewares/requestValidator');
const adminValidation = require('../validations/admin.validation');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { attachVendorScope, superAdminOnly } = require('../middlewares/adminScopeMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');
const { ROLES } = require('../utils/constants');
const { upload, uploadBanner, uploadCategory, uploadInventory } = require('../config/multer');

const router = express.Router();

router.use(authMiddleware, roleMiddleware(ROLES.SUPER_ADMIN, ROLES.VENDOR, ROLES.SUB_ADMIN), attachVendorScope);

// Cities
router.post('/cities', permissionMiddleware('cities_add', false), validate(adminValidation.createCity), adminController.createCity);
router.get('/cities', permissionMiddleware('cities_view', true), validate(adminValidation.getCities), adminController.getCities);
router.put('/cities/:id', permissionMiddleware('cities_edit', false), validate(adminValidation.updateCity), adminController.updateCity);
router.delete('/cities/:id', permissionMiddleware('cities_delete', false), validate(adminValidation.updateCity), adminController.deleteCity);

// Vendors
router.post('/vendors', permissionMiddleware('vendors_add', false), validate(adminValidation.createVendor), adminController.createVendor);
router.get('/vendors', permissionMiddleware('vendors_view', true), validate(adminValidation.getVendors), adminController.getVendors);
router.get('/vendors/:id', permissionMiddleware('vendors_view', true), validate(adminValidation.vendorIdParam), adminController.getVendorById);
router.put('/vendors/:id', permissionMiddleware('vendors_edit', false), validate(adminValidation.updateVendor), adminController.updateVendor);
router.delete('/vendors/:id', permissionMiddleware('vendors_delete', false), validate(adminValidation.vendorIdParam), adminController.deleteVendor);

// Inventory & product orders
router.get('/inventory', permissionMiddleware('inventory_view', true), validate(adminValidation.getInventory), adminController.getInventory);
router.post(
  '/inventory',
  uploadInventory.single('image'),
  permissionMiddleware('inventory_add', true),
  validate(adminValidation.createInventoryItem),
  adminController.createInventoryItem
);
router.put(
  '/inventory/:id',
  uploadInventory.single('image'),
  permissionMiddleware('inventory_edit', true),
  validate(adminValidation.updateInventoryItem),
  adminController.updateInventoryItem
);
router.delete('/inventory/:id', permissionMiddleware('inventory_delete', true), validate(adminValidation.inventoryIdParam), adminController.deleteInventoryItem);
router.get('/product-orders', permissionMiddleware('orders_view', true), validate(adminValidation.getProductOrders), adminController.getProductOrders);
router.patch(
  '/product-orders/:id/status',
  permissionMiddleware('orders_edit', true),
  validate(adminValidation.updateProductOrderStatus),
  adminController.updateProductOrderStatus
);

// Banners
router.post('/banners', permissionMiddleware('banners_add', false), uploadBanner.single('image'), validate(adminValidation.createBanner), adminController.createBanner);
router.get('/banners', permissionMiddleware('banners_view', false), validate(adminValidation.getBanners), adminController.getBanners);
router.put('/banners/:id', permissionMiddleware('banners_edit', false), uploadBanner.single('image'), validate(adminValidation.updateBanner), adminController.updateBanner);
router.delete('/banners/:id', permissionMiddleware('banners_delete', false), validate(adminValidation.bannerIdParam), adminController.deleteBanner);

// Categories
router.post('/categories', permissionMiddleware('categories_add', false), uploadCategory.single('image'), validate(adminValidation.createCategory), adminController.createCategory);
router.get('/categories', permissionMiddleware('categories_view', false), validate(adminValidation.getCategories), adminController.getCategories);
router.put('/categories/:id', permissionMiddleware('categories_edit', false), uploadCategory.single('image'), validate(adminValidation.updateCategory), adminController.updateCategory);
router.delete('/categories/:id', permissionMiddleware('categories_delete', false), validate(adminValidation.categoryIdParam), adminController.deleteCategory);

// Services
router.post('/services', permissionMiddleware('services_add', false), upload.single('image'), validate(adminValidation.createService), adminController.createService);
router.get('/services', permissionMiddleware('services_view', false), validate(adminValidation.getServices), adminController.getServices);
router.put('/services/:id', permissionMiddleware('services_edit', false), upload.single('image'), validate(adminValidation.updateService), adminController.updateService);
router.delete('/services/:id', permissionMiddleware('services_delete', false), validate(adminValidation.serviceIdParam), adminController.deleteService);

// Beauticians
router.get('/beauticians', permissionMiddleware('beauticians_view', true), validate(adminValidation.getBeauticians), adminController.getBeauticians);
router.get('/beauticians/:id', permissionMiddleware('beauticians_view', true), validate(adminValidation.beauticianIdParam), adminController.getBeauticianById);
router.get('/beauticians/:id/live-location', permissionMiddleware('beauticians_view', true), validate(adminValidation.beauticianIdParam), adminController.getBeauticianLiveLocation);
router.put('/beauticians/:id', permissionMiddleware('beauticians_edit', true), validate(adminValidation.updateBeautician), adminController.updateBeautician);
router.post('/beauticians', permissionMiddleware('beauticians_add', true), validate(adminValidation.createBeautician), adminController.createBeautician);

// Users
router.get('/users', permissionMiddleware('users_view', true), validate(adminValidation.getUsers), adminController.getUsers);
router.get('/users/:id', permissionMiddleware('users_view', true), validate(adminValidation.userIdParam), adminController.getUserById);
router.put('/users/:id', permissionMiddleware('users_edit', false), validate(adminValidation.updateUser), adminController.updateUser);

// Alerts, payments, reports
router.get('/alerts', permissionMiddleware('alerts_view', true), adminController.getAlerts);
router.get('/payments', permissionMiddleware('payments_view', true), validate(adminValidation.getPayments), adminController.getPayments);

// Appointments
router.get('/appointments', permissionMiddleware('appointments_view', true), validate(adminValidation.getAppointments), adminController.getAppointments);
router.get('/appointments/:id', permissionMiddleware('appointments_view', true), validate(adminValidation.appointmentIdParam), adminController.getAppointmentById);
router.put('/appointments/:id', permissionMiddleware('appointments_edit', true), validate(adminValidation.appointmentIdParam), adminController.updateAppointment);

// Dashboard & Reports
router.get('/dashboard', permissionMiddleware('dashboard_view', true), adminController.getDashboard);
router.get('/reports', permissionMiddleware('reports_view', true), validate(adminValidation.getReports), adminController.getReports);
router.get('/invoices/:id', permissionMiddleware('appointments_view', true), adminController.getInvoice);
router.get('/vendors/:id/financials', permissionMiddleware('vendors_view', true), adminController.getVendorFinancials);
router.get('/beauticians/:id/financials', permissionMiddleware('beauticians_view', true), adminController.getBeauticianFinancials);

// Sub-Admin management - ONLY Super Admin
router.get('/sub-admins', superAdminOnly, adminController.getSubAdmins);
router.post('/sub-admins', superAdminOnly, adminController.createSubAdmin);
router.put('/sub-admins/:id', superAdminOnly, adminController.updateSubAdmin);
router.delete('/sub-admins/:id', superAdminOnly, adminController.deleteSubAdmin);

// Referral program
router.get('/referral-settings', permissionMiddleware('settings_view', false), adminController.getReferralSettings);
router.put('/referral-settings', permissionMiddleware('settings_edit', false), validate(adminValidation.updateReferralSettings), adminController.updateReferralSettings);

// System Settings
router.get('/system-settings', permissionMiddleware('settings_view', false), adminController.getSystemSettings);
router.put('/system-settings', permissionMiddleware('settings_edit', false), adminController.updateSystemSettings);

module.exports = router;
