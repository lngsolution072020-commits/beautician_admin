const crypto = require('crypto');
const Razorpay = require('razorpay');
const env = require('../config/env');

let client;

function getClient() {
  const { keyId, keySecret } = env.razorpay;
  if (!keyId || !keySecret) return null;
  if (!client) {
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return client;
}

function isConfigured() {
  return Boolean(env.razorpay.keyId && env.razorpay.keySecret);
}

/** 'test' | 'live' — from RAZORPAY_MODE or inferred from key id prefix */
function getRazorpayMode() {
  const m = String(env.razorpay.mode || '').trim().toLowerCase();
  if (m === 'live' || m === 'test') return m;
  const id = env.razorpay.keyId || '';
  if (id.startsWith('rzp_live_')) return 'live';
  if (id.startsWith('rzp_test_')) return 'test';
  return env.nodeEnv === 'production' ? 'live' : 'test';
}

function verifyPaymentSignature(orderId, razorpayPaymentId, razorpaySignature) {
  if (!orderId || !razorpayPaymentId || !razorpaySignature || !env.razorpay.keySecret) {
    return false;
  }
  const body = `${orderId}|${razorpayPaymentId}`;
  const expected = crypto.createHmac('sha256', env.razorpay.keySecret).update(body).digest('hex');
  if (expected.length !== razorpaySignature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(razorpaySignature, 'utf8'));
  } catch {
    return false;
  }
}

/** INR rupees → paise (integer) for Razorpay Orders API */
function rupeesToPaise(rupees) {
  const n = Math.round(Number(rupees) * 100);
  return Math.max(100, n);
}

module.exports = {
  getClient,
  isConfigured,
  getRazorpayMode,
  verifyPaymentSignature,
  rupeesToPaise
};
