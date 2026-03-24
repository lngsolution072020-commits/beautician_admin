const Appointment = require('../models/Appointment');
const LocationTracking = require('../models/LocationTracking');
const Inventory = require('../models/Inventory');
const BeauticianProfile = require('../models/BeauticianProfile');
const ApiError = require('../utils/apiError');
const { APPOINTMENT_STATUS } = require('../utils/constants');
const { getPagination, getMeta } = require('../utils/pagination');
const { buildPoint } = require('../utils/location');
const appointmentRatingService = require('./appointmentRating.service');

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

// Appointments list for beautician
const getAppointments = async (beauticianId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { beautician: beauticianId };
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Appointment.find(filter)
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

const rejectAppointment = (beauticianId, id) =>
  updateStatus(beauticianId, id, [APPOINTMENT_STATUS.PENDING], APPOINTMENT_STATUS.REJECTED);

const startAppointment = async (beauticianId, id) => {
  await assertNoPendingBeauticianRatings(beauticianId);
  return updateStatus(
    beauticianId,
    id,
    [APPOINTMENT_STATUS.ACCEPTED],
    APPOINTMENT_STATUS.IN_PROGRESS,
    'startedAt'
  );
};

const completeAppointment = async (beauticianId, id) => {
  await assertNoPendingBeauticianRatings(beauticianId);
  return updateStatus(
    beauticianId,
    id,
    [APPOINTMENT_STATUS.IN_PROGRESS],
    APPOINTMENT_STATUS.COMPLETED,
    'completedAt'
  );
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

  if (![APPOINTMENT_STATUS.ACCEPTED, APPOINTMENT_STATUS.IN_PROGRESS].includes(appt.status)) {
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

// Product usage (simple decrement in inventory)
const recordProductUsage = async (beauticianId, { inventoryItemId, quantityUsed }) => {
  const item = await Inventory.findById(inventoryItemId).populate('vendor');
  if (!item) throw new ApiError(404, 'Inventory item not found');

  // In real implementation you would verify beautician's vendor matches inventory vendor

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

module.exports = {
  getAppointments,
  acceptAppointment,
  rejectAppointment,
  startAppointment,
  completeAppointment,
  getPendingRatingsForBeautician,
  submitBeauticianRating,
  updateLocation,
  getLocationHistory,
  recordProductUsage,
  setAvailability,
  getKyc,
  submitKyc
};

