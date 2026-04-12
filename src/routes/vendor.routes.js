const express = require('express');
const vendorController = require('../controllers/vendor.controller');
const validate = require('../middlewares/requestValidator');
const vendorValidation = require('../validations/vendor.validation');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// All vendor routes require vendor role
router.use(authMiddleware, roleMiddleware(ROLES.VENDOR));

// Beauticians
router.post('/beauticians', validate(vendorValidation.createBeautician), vendorController.createBeautician);
router.get('/beauticians', validate(vendorValidation.getBeauticians), vendorController.getBeauticians);
router.get('/city-users', vendorController.getCityUsers);
router.put('/beauticians/:id', validate(vendorValidation.updateBeautician), vendorController.updateBeautician);
router.delete('/beauticians/:id', validate(vendorValidation.beauticianIdParam), vendorController.deleteBeautician);

// Appointments
router.get('/appointments', validate(vendorValidation.getAppointments), vendorController.getAppointments);
router.get('/appointments/:id', validate(vendorValidation.appointmentIdParam), vendorController.getAppointmentById);
router.put('/appointments/:id/assign-beautician', validate(vendorValidation.assignBeautician), vendorController.assignBeautician);

// Inventory
router.post('/inventory', validate(vendorValidation.createInventory), vendorController.createInventoryItem);
router.get('/inventory', validate(vendorValidation.getInventory), vendorController.getInventory);
router.put('/inventory/:id', validate(vendorValidation.updateInventory), vendorController.updateInventoryItem);
router.delete('/inventory/:id', validate(vendorValidation.inventoryIdParam), vendorController.deleteInventoryItem);

// Earnings & reports
router.get('/earnings', validate(vendorValidation.earningsQuery), vendorController.getEarnings);
router.get('/reports', validate(vendorValidation.reportsQuery), vendorController.getReports);

module.exports = router;

