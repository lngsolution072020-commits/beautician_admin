const logger = require('../config/logger');
const BeauticianProfile = require('../models/BeauticianProfile');
const User = require('../models/User');
const LocationTracking = require('../models/LocationTracking');
const Vendor = require('../models/Vendor');
const SystemSettings = require('../models/SystemSettings');
const { getDistanceInKm } = require('../utils/location');
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
const pickBeauticianForBooking = async (customerId, preferredBeauticianUserId, excludeUserIds = [], appointmentLocation = null) => {
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

  // Exclude beauticians not in the same city or already tried
  const potentialList = list.filter((p) => cityOk(p) && !excludeSet.has(String(p.user._id)));

  let maxDistanceKm = 10;
  const settings = await SystemSettings.findOne().lean();
  if (settings && settings.beauticianMaxDistanceKm) maxDistanceKm = settings.beauticianMaxDistanceKm;

  let distanceFilteredList = potentialList;

  if (appointmentLocation && appointmentLocation.coordinates) {
    const [apptLng, apptLat] = appointmentLocation.coordinates;
    const beauticianUserIds = potentialList.map((p) => p.user._id);

    // Get latest location tracking for these beauticians
    const latestLocations = await LocationTracking.aggregate([
      { $match: { beautician: { $in: beauticianUserIds } } },
      { $sort: { recordedAt: -1 } },
      { $group: { _id: '$beautician', location: { $first: '$location' } } }
    ]);
    const locationMap = {};
    latestLocations.forEach((ll) => { locationMap[String(ll._id)] = ll.location; });

    // Also get Vendor locations to fallback if tracking is not there
    const vendorIds = [...new Set(potentialList.map((p) => p.vendor).filter(Boolean))];
    const vendors = await Vendor.find({ _id: { $in: vendorIds } }).lean();
    const vendorMap = {};
    vendors.forEach((v) => { vendorMap[String(v._id)] = v; });

    distanceFilteredList = [];
    for (const p of potentialList) {
      let bLoc = locationMap[String(p.user._id)];
      if (!bLoc || !bLoc.coordinates) {
        if (p.vendor && vendorMap[String(p.vendor)]) {
          const v = vendorMap[String(p.vendor)];
          if (v.latitude && v.longitude) {
            bLoc = { coordinates: [v.longitude, v.latitude] };
          }
        }
      }

      if (bLoc && bLoc.coordinates) {
        const dist = getDistanceInKm({ coordinates: [apptLng, apptLat] }, bLoc);
        if (dist !== null && dist <= maxDistanceKm) {
          distanceFilteredList.push(p);
        }
      } else {
        // If we don't have ANY location info, assume ok as they are in the same city
        distanceFilteredList.push(p);
      }
    }
  }

  const approvedInCity = distanceFilteredList.find((p) => p.kycStatus === 'approved');
  if (approvedInCity) return approvedInCity;

  const pendingInCity = distanceFilteredList.find((p) => p.kycStatus === 'pending');
  return pendingInCity || null;
};

module.exports = {
  pickBeauticianForBooking
};
