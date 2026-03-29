const User = require('../models/User');
const Appointment = require('../models/Appointment');
const CustomerProfile = require('../models/CustomerProfile');
const BeauticianProfile = require('../models/BeauticianProfile');
const ReferralPayout = require('../models/ReferralPayout');
const referralSettingsService = require('./referralSettings.service');
const { generateUniqueReferralCode } = require('../utils/referralCode');
const { ROLES, APPOINTMENT_STATUS } = require('../utils/constants');

/**
 * Ensure legacy users have a referral code (for sharing).
 */
async function ensureReferralCodeForUser(userId) {
  const u = await User.findById(userId).select('referralCode role');
  if (!u) return null;
  if (u.referralCode) return u.referralCode;
  if (![ROLES.CUSTOMER, ROLES.BEAUTICIAN].includes(u.role)) return null;
  const code = await generateUniqueReferralCode();
  await User.updateOne({ _id: userId }, { $set: { referralCode: code } });
  return code;
}

async function getReferralInfoForUser(userId) {
  const code = await ensureReferralCodeForUser(userId);
  const settings = await referralSettingsService.getReferralSettings();
  return {
    referralCode: code,
    isEnabled: settings.isEnabled,
    customerRewardAmount: settings.customerRewardAmount,
    beauticianRewardAmount: settings.beauticianRewardAmount,
    shareMessage:
      'Join me on Nova Beauty! Use my referral code when you sign up. Rewards apply after your first completed booking.'
  };
}

/**
 * When a customer's first appointment is marked completed, credit referee + referrer wallets (once).
 */
async function applyReferralRewardsOnAppointmentCompleted(appointmentId) {
  const settings = await referralSettingsService.getReferralSettings();
  if (!settings.isEnabled) return null;

  const appt = await Appointment.findById(appointmentId).lean();
  if (!appt || appt.status !== APPOINTMENT_STATUS.COMPLETED) return null;

  const customerId = appt.customer;
  const completedCount = await Appointment.countDocuments({
    customer: customerId,
    status: APPOINTMENT_STATUS.COMPLETED
  });
  if (completedCount !== 1) return null;

  const customerUser = await User.findById(customerId).select('referredBy').lean();
  if (!customerUser?.referredBy) return null;

  const existing = await ReferralPayout.findOne({ referee: customerId }).lean();
  if (existing) return null;

  const referrer = await User.findById(customerUser.referredBy).select('role isActive').lean();
  if (!referrer || !referrer.isActive) return null;

  const customerAmt = Math.max(0, Number(settings.customerRewardAmount) || 0);
  const beauticianAmt = Math.max(0, Number(settings.beauticianRewardAmount) || 0);

  let referrerReward = 0;
  if (referrer.role === ROLES.BEAUTICIAN) {
    referrerReward = beauticianAmt;
  } else if (referrer.role === ROLES.CUSTOMER) {
    referrerReward = customerAmt;
  } else {
    return null;
  }

  if (customerAmt <= 0 && referrerReward <= 0) {
    return null;
  }

  const cp = await CustomerProfile.findOne({ user: customerId });
  if (cp && customerAmt > 0) {
    cp.walletBalance = (cp.walletBalance != null ? cp.walletBalance : 0) + customerAmt;
    await cp.save();
  }

  if (referrerReward > 0) {
    if (referrer.role === ROLES.BEAUTICIAN) {
      const bp = await BeauticianProfile.findOne({ user: referrer._id });
      if (bp) {
        bp.walletBalance = (bp.walletBalance != null ? bp.walletBalance : 0) + referrerReward;
        await bp.save();
      }
    } else {
      const rcp = await CustomerProfile.findOne({ user: referrer._id });
      if (rcp) {
        rcp.walletBalance = (rcp.walletBalance != null ? rcp.walletBalance : 0) + referrerReward;
        await rcp.save();
      }
    }
  }

  await ReferralPayout.create({
    referee: customerId,
    referrer: referrer._id,
    appointment: appt._id,
    customerReward: customerAmt,
    referrerReward: referrerReward
  });

  return true;
}

module.exports = {
  ensureReferralCodeForUser,
  getReferralInfoForUser,
  applyReferralRewardsOnAppointmentCompleted
};
