const logger = require('../config/logger');
const BeauticianProfile = require('../models/BeauticianProfile');
const User = require('../models/User');
const { ROLES } = require('../utils/constants');

const firstNotExcluded = (list, excludeSet) => {
  for (const p of list) {
    if (p.user && !excludeSet.has(String(p.user._id))) return p;
  }
  return null;
};

/**
 * Pick beautician for a new booking: optional preferred user id, else best match.
 * @param {string} customerId
 * @param {string|null} preferredBeauticianUserId
 * @param {string[]} excludeUserIds – never offer to these user ids (already passed / timed out)
 */
const pickBeauticianForBooking = async (customerId, preferredBeauticianUserId, excludeUserIds = []) => {
  const excludeSet = new Set((excludeUserIds || []).map(String).filter(Boolean));

  const customer = await User.findById(customerId).select('city').lean();
  const customerCityId = customer?.city ? String(customer.city) : null;

  if (preferredBeauticianUserId && !excludeSet.has(String(preferredBeauticianUserId).trim())) {
    const prefId = String(preferredBeauticianUserId).trim();
    const user = await User.findById(prefId).select('role isActive city').lean();
    if (user && user.role === ROLES.BEAUTICIAN && user.isActive) {
      const profile = await BeauticianProfile.findOne({ user: prefId }).populate({
        path: 'user',
        select: 'role isActive city',
        match: { role: ROLES.BEAUTICIAN, isActive: true }
      });
      if (profile?.user && profile.kycStatus !== 'rejected') {
        const okCity =
          !customerCityId || !user.city || String(user.city) === customerCityId;
        if (okCity) return profile;
      }
    }
    logger.warn('Preferred beautician %s not usable; auto-assigning another expert', prefId);
  }

  const list = await BeauticianProfile.find({
    isAvailable: true,
    kycStatus: { $in: ['approved', 'pending'] }
  })
    .populate({
      path: 'user',
      select: 'role isActive city',
      match: { role: ROLES.BEAUTICIAN, isActive: true }
    })
    .sort({ rating: -1, updatedAt: -1 })
    .limit(120);

  const cityOk = (p) =>
    p.user && (!customerCityId || !p.user.city || String(p.user.city) === customerCityId);

  const approvedInCity = list.filter((_p) => _p.kycStatus === 'approved' && cityOk(_p));
  const fromApproved = firstNotExcluded(approvedInCity, excludeSet);
  if (fromApproved) return fromApproved;

  const approvedAny = list.filter((_p) => _p.kycStatus === 'approved' && _p.user);
  const fromApprovedAny = firstNotExcluded(approvedAny, excludeSet);
  if (fromApprovedAny) return fromApprovedAny;

  const pendingInCity = list.filter((_p) => _p.kycStatus === 'pending' && cityOk(_p));
  const fromPending = firstNotExcluded(pendingInCity, excludeSet);
  if (fromPending) return fromPending;

  const pendingAny = list.filter((_p) => _p.kycStatus === 'pending' && _p.user);
  return firstNotExcluded(pendingAny, excludeSet) || null;
};

module.exports = {
  pickBeauticianForBooking
};
