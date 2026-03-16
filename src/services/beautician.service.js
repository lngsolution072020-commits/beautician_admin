const Appointment = require('../models/Appointment');
const LocationTracking = require('../models/LocationTracking');
const Inventory = require('../models/Inventory');
const ApiError = require('../utils/apiError');
const { APPOINTMENT_STATUS } = require('../utils/constants');
const { getPagination, getMeta } = require('../utils/pagination');
const { buildPoint } = require('../utils/location');

// Ensure beautician owns the appointment
const assertBeauticianAccess = (appointment, beauticianId) => {
  if (!appointment.beautician || String(appointment.beautician) !== String(beauticianId)) {
    throw new ApiError(403, 'Forbidden: appointment not assigned to beautician');
  }
};

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

const acceptAppointment = (beauticianId, id) =>
  updateStatus(beauticianId, id, [APPOINTMENT_STATUS.PENDING], APPOINTMENT_STATUS.ACCEPTED);

const rejectAppointment = (beauticianId, id) =>
  updateStatus(beauticianId, id, [APPOINTMENT_STATUS.PENDING], APPOINTMENT_STATUS.REJECTED);

const startAppointment = (beauticianId, id) =>
  updateStatus(
    beauticianId,
    id,
    [APPOINTMENT_STATUS.ACCEPTED],
    APPOINTMENT_STATUS.IN_PROGRESS,
    'startedAt'
  );

const completeAppointment = (beauticianId, id) =>
  updateStatus(
    beauticianId,
    id,
    [APPOINTMENT_STATUS.IN_PROGRESS],
    APPOINTMENT_STATUS.COMPLETED,
    'completedAt'
  );

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

module.exports = {
  getAppointments,
  acceptAppointment,
  rejectAppointment,
  startAppointment,
  completeAppointment,
  updateLocation,
  getLocationHistory,
  recordProductUsage
};

