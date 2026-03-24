const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file located at backend root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/beauticianapp',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  },
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    /** Optional: `test` | `live`. If unset, inferred from key id (rzp_test_ / rzp_live_) or NODE_ENV. */
    mode: process.env.RAZORPAY_MODE || ''
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || ''
  },
  logLevel: process.env.LOG_LEVEL || 'info'
};

module.exports = env;

