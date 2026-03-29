const User = require('../models/User');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * @returns {Promise<string>} 8-character unique referral code
 */
async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let code = '';
    for (let i = 0; i < 8; i += 1) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.findOne({ referralCode: code }).select('_id').lean();
    if (!exists) return code;
  }
  const err = new Error('Could not generate referral code');
  err.statusCode = 500;
  throw err;
}

function normalizeReferralCodeInput(raw) {
  if (raw == null || raw === '') return '';
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

module.exports = {
  generateUniqueReferralCode,
  normalizeReferralCodeInput
};
