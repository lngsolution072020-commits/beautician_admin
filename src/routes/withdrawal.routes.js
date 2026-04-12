const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawal.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { ROLES } = require('../utils/constants');

// Beautician routes
router.post('/request', authMiddleware, roleMiddleware(ROLES.BEAUTICIAN), withdrawalController.createRequest);
router.get('/my', authMiddleware, roleMiddleware(ROLES.BEAUTICIAN), withdrawalController.getMyWithdrawals);

// Admin routes
router.get('/admin/all', authMiddleware, roleMiddleware(ROLES.SUPER_ADMIN), withdrawalController.getAllRequests);
router.patch('/admin/:id/status', authMiddleware, roleMiddleware(ROLES.SUPER_ADMIN), withdrawalController.updateStatus);

module.exports = router;
