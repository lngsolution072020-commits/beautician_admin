const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const LocationTracking = require('../models/LocationTracking');
const Inventory = require('../models/Inventory');
const BeauticianProfile = require('../models/BeauticianProfile');
const ApiError = require('../utils/apiError');
const { APPOINTMENT_STATUS } = require('../utils/constants');
const { getPagination, getMeta } = require('../utils/pagination');
const { buildPoint } = require('../utils/location');
const appointmentRatingService = require('./appointmentRating.service');
const referralService = require('./referral.service');
const appointmentOfferService = require('./appointmentOffer.service');

// Ensure beautician owns the appointment
const assertBeauticianAccess = (appointment, beauticianId) => {
  if (!appointment.beautician || String(appointment.beautician) !== String(beauticianId)) {
    throw new ApiError(403, 'Forbidden: appointment not assigned to beautician');
  }
};

async function assertNoPendingBeauticianRatings(beauticianId) {
  const n = await appointmentRatingService.countPendingBeauticianRatings(beauticianId);
  if (n > 0) {
    throw new ApiError(400, 'Please rate your customers for completed appointments first.');
  }
}

const getAppointmentById = async (beauticianId, id) => {
  const appt = await Appointment.findById(id)
    .select('-serviceStartOtp -serviceStartOtpExpiresAt')
    .populate('customer service');
  if (!appt) throw new ApiError(404, 'Appointment not found');
  assertBeauticianAccess(appt, beauticianId);
  return appt;
};

function generateServiceOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

const markEnRoute = async (beauticianId, id) => {
  await assertNoPendingBeauticianRatings(beauticianId);
  return updateStatus(beauticianId, id, [APPOINTMENT_STATUS.ACCEPTED], APPOINTMENT_STATUS.IN_TRANSIT);
};

const markReached = async (beauticianId, id) => {
  await assertNoPendingBeauticianRatings(beauticianId);
  const appt = await Appointment.findById(id);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  assertBeauticianAccess(appt, beauticianId);
  if (appt.status !== APPOINTMENT_STATUS.IN_TRANSIT) {
    throw new ApiError(400, 'Tap "Go for service" first, then mark when you arrive');
  }
  appt.status = APPOINTMENT_STATUS.REACHED;
  appt.serviceStartOtp = generateServiceOtp();
  appt.serviceStartOtpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await appt.save();
  return Appointment.findById(id).select('-serviceStartOtp -serviceStartOtpExpiresAt').populate('customer service');
};

const verifyServiceOtpAndStart = async (beauticianId, id, rawOtp) => {
  await assertNoPendingBeauticianRatings(beauticianId);
  const appt = await Appointment.findById(id);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  assertBeauticianAccess(appt, beauticianId);
  if (appt.status !== APPOINTMENT_STATUS.REACHED) {
    throw new ApiError(400, 'Ask the customer to open their booking — the code appears after you mark arrival');
  }
  const otp = String(rawOtp || '')
    .replace(/\D/g, '')
    .slice(0, 6);
  if (otp.length !== 6) {
    throw new ApiError(400, 'Enter the 6-digit code from the customer app');
  }
  if (!appt.serviceStartOtp || appt.serviceStartOtp !== otp) {
    throw new ApiError(400, 'Invalid code. Check with the customer on their order screen.');
  }
  if (!appt.serviceStartOtpExpiresAt || new Date(appt.serviceStartOtpExpiresAt) < new Date()) {
    throw new ApiError(400, 'Code expired. Mark arrival again to generate a new code.');
  }
  appt.status = APPOINTMENT_STATUS.IN_PROGRESS;
  appt.startedAt = new Date();
  appt.serviceStartOtp = null;
  appt.serviceStartOtpExpiresAt = null;
  await appt.save();
  return Appointment.findById(id).populate('customer service');
};

// Appointments list for beautician
const getAppointments = async (beauticianId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { beautician: beauticianId };
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .select('-serviceStartOtp -serviceStartOtpExpiresAt')
      .populate('customer service')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    Appointment.countDocuments(filter)
  ]);

  return { items, meta: getMeta({ page, limit, total }) };
};

// Update appointment status helpers
const updateStatus = async (beauticianId, id, allowedFromStatuses, newStatus, timeField) => {
  const appt = await Appointment.findById(id);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  assertBeauticianAccess(appt, beauticianId);

  if (!allowedFromStatuses.includes(appt.status)) {
    throw new ApiError(400, `Cannot move from status ${appt.status} to ${newStatus}`);
  }

  appt.status = newStatus;
  if (newStatus === APPOINTMENT_STATUS.ACCEPTED) {
    appt.offerExpiresAt = null;
  }
  if (timeField) {
    appt[timeField] = new Date();
  }
  await appt.save();
  return appt;
};

const acceptAppointment = async (beauticianId, id) => {
  await assertNoPendingBeauticianRatings(beauticianId);
  return updateStatus(beauticianId, id, [APPOINTMENT_STATUS.PENDING], APPOINTMENT_STATUS.ACCEPTED);
};

const rejectAppointment = async (beauticianId, id) => {
  const appt = await Appointment.findById(id);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  assertBeauticianAccess(appt, beauticianId);
  if (appt.status !== APPOINTMENT_STATUS.PENDING) {
    throw new ApiError(400, 'Only pending offers can be declined');
  }
  const result = await appointmentOfferService.passToNextBeautician(id, beauticianId);
  if (!result.ok) {
    throw new ApiError(400, 'Unable to update this booking');
  }
  return Appointment.findById(id).populate('customer service');
};


const completeAppointment = async (beauticianId, id) => {
  await assertNoPendingBeauticianRatings(beauticianId);
  const appt = await updateStatus(
    beauticianId,
    id,
    [APPOINTMENT_STATUS.IN_PROGRESS],
    APPOINTMENT_STATUS.COMPLETED,
    'completedAt'
  );

  // Credit beautician wallet
  const profile = await BeauticianProfile.findOne({ user: beauticianId });
  if (profile) {
    const commission = profile.platformCommissionPercent || 10;
    const shareAmount = appt.price - (appt.price * commission) / 100;
    profile.walletBalance = (profile.walletBalance || 0) + Math.round(shareAmount);
    await profile.save();
  }

  referralService.applyReferralRewardsOnAppointmentCompleted(appt._id).catch(() => {});
  return appt;
};

const getPendingRatingsForBeautician = async (beauticianId) => {
  const items = await Appointment.find({
    beautician: beauticianId,
    status: APPOINTMENT_STATUS.COMPLETED,
    'ratingFromBeautician.stars': { $exists: false }
  })
    .populate('customer', 'name phone')
    .populate('service', 'name')
    .sort({ completedAt: -1 })
    .lean();

  return { items };
};

const submitBeauticianRating = async (beauticianId, appointmentId, { stars, comment }) => {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  assertBeauticianAccess(appt, beauticianId);
  if (appt.status !== APPOINTMENT_STATUS.COMPLETED) {
    throw new ApiError(400, 'You can rate only after the service is completed');
  }
  if (appt.ratingFromBeautician && appt.ratingFromBeautician.stars != null) {
    throw new ApiError(400, 'You have already submitted a rating');
  }
  const s = Math.min(5, Math.max(1, Math.round(Number(stars))));
  if (!Number.isFinite(s)) throw new ApiError(400, 'Invalid rating');
  appt.ratingFromBeautician = {
    stars: s,
    comment: comment ? String(comment).trim().slice(0, 500) : '',
    createdAt: new Date()
  };
  await appt.save();
  await appointmentRatingService.recalculateCustomerAverageRating(appt.customer);
  return appt;
};

// Location tracking
const updateLocation = async (beauticianId, { appointmentId, lat, lng }) => {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  assertBeauticianAccess(appt, beauticianId);

  if (
    ![
      APPOINTMENT_STATUS.ACCEPTED,
      APPOINTMENT_STATUS.IN_TRANSIT,
      APPOINTMENT_STATUS.REACHED,
      APPOINTMENT_STATUS.IN_PROGRESS
    ].includes(appt.status)
  ) {
    throw new ApiError(400, 'Location tracking allowed only for active appointments');
  }

  const location = buildPoint(lat, lng);

  const tracking = await LocationTracking.create({
    beautician: beauticianId,
    appointment: appointmentId,
    location
  });

  return tracking;
};

const getLocationHistory = async (beauticianId, { appointmentId, page, limit }) => {
  const paginationQuery = { page, limit };
  const { page: p, limit: l, skip } = getPagination(paginationQuery);

  const filter = { beautician: beauticianId };
  if (appointmentId) filter.appointment = appointmentId;

  const [items, total] = await Promise.all([
    LocationTracking.find(filter)
      .skip(skip)
      .limit(l)
      .sort({ recordedAt: -1 }),
    LocationTracking.countDocuments(filter)
  ]);

  return { items, meta: getMeta({ page: p, limit: l, total }) };
};

/** Active inventory rows for the beautician's linked vendor (vendor panel manages stock). */
const getVendorInventoryForBeautician = async (beauticianId) => {
  const profile = await BeauticianProfile.findOne({ user: beauticianId }).select('vendor').lean();
  if (!profile?.vendor) {
    return { items: [] };
  }
  const items = await Inventory.find({ vendor: profile.vendor, isActive: true })
    .sort({ name: 1 })
    .limit(200)
    .lean();
  return {
    items: items.map((i) => ({
      _id: i._id.toString(),
      name: i.name,
      sku: i.sku || '',
      unit: (i.unit && String(i.unit).trim()) || 'pcs',
      quantity: typeof i.quantity === 'number' ? i.quantity : 0
    }))
  };
};

// Product usage (decrement inventory; must belong to beautician's vendor)
const recordProductUsage = async (beauticianId, { inventoryItemId, quantityUsed }) => {
  const profile = await BeauticianProfile.findOne({ user: beauticianId }).select('vendor').lean();
  if (!profile?.vendor) {
    throw new ApiError(403, 'Beautician is not linked to a vendor');
  }
  const item = await Inventory.findById(inventoryItemId);
  if (!item) throw new ApiError(404, 'Inventory item not found');
  if (String(item.vendor) !== String(profile.vendor)) {
    throw new ApiError(403, 'This product is not in your salon inventory');
  }

  item.quantity = Math.max(0, (item.quantity || 0) - quantityUsed);
  await item.save();

  return item;
};

// Availability toggle (used by beautician app)
const setAvailability = async (beauticianId, isAvailable) => {
  const profile = await BeauticianProfile.findOne({ user: beauticianId });
  if (!profile) throw new ApiError(404, 'Beautician profile not found');
  profile.isAvailable = !!isAvailable;
  await profile.save();
  return { isAvailable: profile.isAvailable };
};

// KYC details for beautician
const getKyc = async (beauticianId) => {
  const profile = await BeauticianProfile.findOne({ user: beauticianId }).lean();
  if (!profile) throw new ApiError(404, 'Beautician profile not found');
  return {
    kycStatus: profile.kycStatus || 'pending',
    documents: (profile.documents || []).map((d) => ({
      id: d._id.toString(),
      type: d.type,
      url: d.url,
      status: d.status,
      notes: d.notes || ''
    }))
  };
};

// Submit / re-submit KYC documents from beautician app
const submitKyc = async (beauticianId, documents) => {
  const profile = await BeauticianProfile.findOne({ user: beauticianId });
  if (!profile) throw new ApiError(404, 'Beautician profile not found');

  const docs = Array.isArray(documents) ? documents : [];
  docs.forEach((doc) => {
    if (!doc || !doc.url || !doc.type) return;
    const existing = profile.documents.find((d) => d.type === doc.type);
    if (existing) {
      existing.url = doc.url;
      existing.status = 'pending';
      existing.notes = '';
    } else {
      profile.documents.push({
        type: doc.type,
        url: doc.url,
        status: 'pending'
      });
    }
  });

  profile.kycStatus = 'pending';
  await profile.save();

  return getKyc(beauticianId);
};

const getMyPlatformCommission = async (beauticianUserId) => {
  const profile = await BeauticianProfile.findOne({ user: beauticianUserId }).select('platformCommissionPercent').lean();
  let pct = profile && profile.platformCommissionPercent;
  if (pct == null || Number.isNaN(Number(pct))) pct = 10;
  pct = Math.min(100, Math.max(0, Number(pct)));
  return { beauticianCommissionPercent: pct };
};

module.exports = {
  getAppointmentById,
  getAppointments,
  acceptAppointment,
  rejectAppointment,
  markEnRoute,
  markReached,
  verifyServiceOtpAndStart,
  completeAppointment,
  getPendingRatingsForBeautician,
  submitBeauticianRating,
  updateLocation,
  getLocationHistory,
  recordProductUsage,
  getVendorInventoryForBeautician,
  setAvailability,
  getKyc,
  submitKyc,
  getMyPlatformCommission
};

