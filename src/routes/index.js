const express = require('express');

const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const vendorRoutes = require('./vendor.routes');
const beauticianRoutes = require('./beautician.routes');
const customerRoutes = require('./customer.routes');
const notificationRoutes = require('./notification.routes');
const withdrawalRoutes = require('./withdrawal.routes');

const router = express.Router();

// Health check endpoint
router.get('/healthcheck', (req, res) => {
  res.json({ success: true, message: 'API is running', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/vendor', vendorRoutes);
router.use('/beautician', beauticianRoutes);
router.use('/customer', customerRoutes);
router.use('/notifications', notificationRoutes);
router.use('/withdrawals', withdrawalRoutes);

module.exports = router;

