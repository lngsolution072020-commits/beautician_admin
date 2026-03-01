const express = require('express');

const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const vendorRoutes = require('./vendor.routes');
const beauticianRoutes = require('./beautician.routes');
const customerRoutes = require('./customer.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/vendor', vendorRoutes);
router.use('/beautician', beauticianRoutes);
router.use('/customer', customerRoutes);

module.exports = router;

