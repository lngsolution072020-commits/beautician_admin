const ApiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const beauticianService = require('../services/beautician.service');
const notificationService = require('../services/notification.service');
const Appointment = require('../models/Appointment');
const { buildFileUrl } = require('../utils/fileUrl');

// Appointments
exports.getAppointments = catchAsync(async (req, res) => {
  const { items, meta } = await beauticianService.getAppointments(req.user.id, req.query);
  const mapped = items.map((appt) => {
    const obj = appt.toObject ? appt.toObject() : appt;
    if (obj.service && obj.service.imageUrl && !obj.service.imageUrl.startsWith('http')) {
      obj.service.imageUrl = buildFileUrl(req, 'services', obj.service.imageUrl);
    }
    return obj;
  });
  return ApiResponse.success(res, {
    message: 'Beautician appointments fetched',
    data: { items: mapped, meta }
  });
});

exports.acceptAppointment = catchAsync(async (req, res) => {
  const appt = await beauticianService.acceptAppointment(req.user.id, req.params.id);
  if (appt?.customer) {
    notificationService.sendFCM(appt.customer._id || appt.customer, {
      title: 'Booking accepted',
      body: 'Your beautician has accepted the booking and is on the way.',
      data: { type: 'appointment_accepted', appointmentId: String(appt._id) }
    }).catch(() => {});
  }
  return ApiResponse.success(res, {
    message: 'Appointment accepted',
    data: appt
  });
});

exports.rejectAppointment = catchAsync(async (req, res) => {
  const appt = await beauticianService.rejectAppointment(req.user.id, req.params.id);
  return ApiResponse.success(res, {
    message: 'Appointment rejected',
    data: appt
  });
});

exports.startAppointment = catchAsync(async (req, res) => {
  const appt = await beauticianService.startAppointment(req.user.id, req.params.id);
  if (appt?.customer) {
    notificationService.sendFCM(appt.customer._id || appt.customer, {
      title: 'Service started',
      body: 'Your beautician has started the service.',
      data: { type: 'appointment_started', appointmentId: String(appt._id) }
    }).catch(() => {});
  }
  return ApiResponse.success(res, {
    message: 'Appointment started',
    data: appt
  });
});

exports.completeAppointment = catchAsync(async (req, res) => {
  const appt = await beauticianService.completeAppointment(req.user.id, req.params.id);
  return ApiResponse.success(res, {
    message: 'Appointment completed',
    data: appt
  });
});

// Location tracking
exports.updateLocation = catchAsync(async (req, res) => {
  const tracking = await beauticianService.updateLocation(req.user.id, req.body);
  const { appointmentId, lat, lng } = req.body;
  let destinationLat; let destinationLng;
  const appt = await Appointment.findById(appointmentId);
  if (appt?.location?.coordinates?.length >= 2) {
    [destinationLng, destinationLat] = appt.location.coordinates;
  }
  const eta = await notificationService.notifyLocationUpdate(
    appointmentId, lat, lng, destinationLat, destinationLng
  );
  const io = req.app.get('io');
  await notificationService.emitLocationToSocket(io, appointmentId, lat, lng, eta);
  return ApiResponse.success(res, {
    message: 'Location updated',
    data: tracking
  });
});

exports.getLocationHistory = catchAsync(async (req, res) => {
  const { items, meta } = await beauticianService.getLocationHistory(req.user.id, req.query);
  return ApiResponse.success(res, {
    message: 'Location history fetched',
    data: { items, meta }
  });
});

// Product usage
exports.recordProductUsage = catchAsync(async (req, res) => {
  const item = await beauticianService.recordProductUsage(req.user.id, req.body);
  return ApiResponse.success(res, {
    message: 'Product usage recorded',
    data: item
  });
});

// Availability
exports.setAvailability = catchAsync(async (req, res) => {
  const { isAvailable } = req.body;
  const result = await beauticianService.setAvailability(req.user.id, isAvailable);
  return ApiResponse.success(res, {
    message: 'Availability updated',
    data: result
  });
});

// KYC – get current status & documents
exports.getKyc = catchAsync(async (req, res) => {
  const data = await beauticianService.getKyc(req.user.id);
  return ApiResponse.success(res, {
    message: 'KYC status',
    data
  });
});

// KYC – submit / re-submit documents
exports.submitKyc = catchAsync(async (req, res) => {
  const data = await beauticianService.submitKyc(req.user.id, req.body.documents);
  return ApiResponse.success(res, {
    message: 'KYC submitted',
    data
  });
});

