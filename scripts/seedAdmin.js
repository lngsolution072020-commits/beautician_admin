/**
 * Create a super_admin user so you can log in to the admin app (beauticianadmin).
 * Run once: node scripts/seedAdmin.js
 * Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, or they default to admin@beauticianapp.com / Admin@123
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { ROLES } = require('../src/utils/constants');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@beauticianapp.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Super Admin';

async function seedAdmin() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/beauticianapp';
  await mongoose.connect(uri);

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    if (existing.role === ROLES.SUPER_ADMIN) {
      console.log('Super admin already exists:', ADMIN_EMAIL);
      await mongoose.disconnect();
      process.exit(0);
      return;
    }
    console.log('User exists but is not super_admin. Updating role...');
    existing.role = ROLES.SUPER_ADMIN;
    await existing.save();
    console.log('Updated', ADMIN_EMAIL, 'to super_admin. You can log in with this email and your existing password.');
  } else {
    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: ROLES.SUPER_ADMIN
    });
    console.log('Super admin created.');
    console.log('Email:', ADMIN_EMAIL);
    console.log('Password:', ADMIN_PASSWORD);
    console.log('Use these to log in at the beauticianadmin app (/login).');
  }

  await mongoose.disconnect();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
