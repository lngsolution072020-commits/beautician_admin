const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawal.controller');
const { protect, restrictTo } = require('../middleware/auth');

// Beautician routes
router.post('/request', protect, restrictTo('beautician'), withdrawalController.createRequest);
router.get('/my', protect, restrictTo('beautician'), withdrawalController.getMyWithdrawals);

// Admin routes
router.get('/admin/all', protect, restrictTo('admin'), withdrawalController.getAllRequests);
router.patch('/admin/:id/status', protect, restrictTo('admin'), withdrawalController.updateStatus);

module.exports = router;
