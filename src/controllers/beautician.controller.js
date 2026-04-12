const ApiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const beauticianService = require('../services/beautician.service');
const referralService = require('../services/referral.service');
const notificationService = require('../services/notification.service');
const Appointment = require('../models/Appointment');
const BeauticianProfile = require('../models/BeauticianProfile');
const { buildFileUrl } = require('../utils/fileUrl');

// Appointments
exports.getPendingRatings = catchAsync(async (req, res) => {
  const data = await beauticianService.getPendingRatingsForBeautician(req.user.id);
  return ApiResponse.success(res, {
    message: 'Pending ratings',
    data
  });
});

exports.rateCustomer = catchAsync(async (req, res) => {
  const appt = await beauticianService.submitBeauticianRating(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, {
    message: 'Thank you for your feedback',
    data: appt
  });
});

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

exports.getAppointmentById = catchAsync(async (req, res) => {
  const appt = await beauticianService.getAppointmentById(req.user.id, req.params.id);
  const obj = appt.toObject ? appt.toObject() : appt;
  if (obj.service && obj.service.imageUrl && !obj.service.imageUrl.startsWith('http')) {
    obj.service.imageUrl = buildFileUrl(req, 'services', obj.service.imageUrl);
  }
  return ApiResponse.success(res, {
    message: 'Appointment details',
    data: obj
  });
});

exports.acceptAppointment = catchAsync(async (req, res) => {
  const appt = await beauticianService.acceptAppointment(req.user.id, req.params.id);
  if (appt?.customer) {
    notificationService.sendFCM(appt.customer._id || appt.customer, {
      title: 'Booking accepted',
      body: 'Your beautician has accepted the booking. Track progress in the app.',
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
  const stillPending = appt?.status === 'pending';
  return ApiResponse.success(res, {
    message: stillPending
      ? 'Offer passed to another beautician'
      : 'Booking could not be assigned; customer has been notified',
    data: appt
  });
});

exports.markEnRoute = catchAsync(async (req, res) => {
  const appt = await beauticianService.markEnRoute(req.user.id, req.params.id);
  if (appt?.customer) {
    notificationService.sendFCM(appt.customer._id || appt.customer, {
      title: 'Expert on the way',
      body: 'Your beautician is travelling to your location. You can track live in the app.',
      data: { type: 'appointment_en_route', appointmentId: String(appt._id) }
    }).catch(() => {});
  }
  return ApiResponse.success(res, {
    message: 'Status updated',
    data: appt
  });
});

exports.markReached = catchAsync(async (req, res) => {
  const appt = await beauticianService.markReached(req.user.id, req.params.id);
  if (appt?.customer) {
    notificationService.sendFCM(appt.customer._id || appt.customer, {
      title: 'Beautician has arrived',
      body: 'Open your order and share the service code with your expert to begin.',
      data: { type: 'appointment_reached', appointmentId: String(appt._id) }
    }).catch(() => {});
  }
  return ApiResponse.success(res, {
    message: 'Arrival saved. Customer can see the code in their app.',
    data: appt
  });
});

exports.verifyServiceOtp = catchAsync(async (req, res) => {
  const appt = await beauticianService.verifyServiceOtpAndStart(req.user.id, req.params.id, req.body.otp);
  if (appt?.customer) {
    notificationService.sendFCM(appt.customer._id || appt.customer, {
      title: 'Service started',
      body: 'Your beautician has started the service.',
      data: { type: 'appointment_started', appointmentId: String(appt._id) }
    }).catch(() => {});
  }
  return ApiResponse.success(res, {
    message: 'Service started',
    data: appt
  });
});

exports.completeAppointment = catchAsync(async (req, res) => {
  const appt = await beauticianService.completeAppointment(req.user.id, req.params.id);
  notificationService.refreshBeauticianPresenceAfterJobComplete(req.user.id).catch(() => {});
  if (appt?.customer) {
    notificationService.sendFCM(appt.customer._id || appt.customer, {
      title: 'Service completed',
      body: 'Please rate your beautician to book your next appointment.',
      data: { type: 'appointment_completed', appointmentId: String(appt._id) }
    }).catch(() => {});
  }
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
  const bp = await BeauticianProfile.findOne({ user: req.user.id }).select('isAvailable').lean();
  const isAvail = bp?.isAvailable !== false;
  const eta = await notificationService.notifyLocationUpdate(
    appointmentId,
    lat,
    lng,
    destinationLat,
    destinationLng,
    req.user.id,
    appt?.status,
    isAvail
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
exports.getInventory = catchAsync(async (req, res) => {
  const data = await beauticianService.getVendorInventoryForBeautician(req.user.id);
  return ApiResponse.success(res, {
    message: 'Vendor inventory',
    data
  });
});

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
  notificationService.syncBeauticianPresenceFromAvailability(req.user.id, result.isAvailable).catch(() => {});
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

// KYC – upload files and return document URLs
exports.uploadKycFiles = catchAsync(async (req, res) => {
  const files = req.files || {};
  const documents = [];

  const pushDoc = (field, type) => {
    if (Array.isArray(files[field]) && files[field][0]) {
      const file = files[field][0];
      const url = buildFileUrl(req, 'kyc', file.filename);
      documents.push({ type, url });
    }
  };

  pushDoc('aadhar', 'aadhar');
  pushDoc('selfie', 'selfie');
  pushDoc('experience', 'experience');

  return ApiResponse.success(res, {
    message: 'KYC files uploaded',
    data: { documents }
  });
});

exports.getReferral = catchAsync(async (req, res) => {
  const data = await referralService.getReferralInfoForUser(req.user.id);
  return ApiResponse.success(res, {
    message: 'Referral',
    data
  });
});

/** Per-beautician platform fee % (from admin). */
exports.getMyCommission = catchAsync(async (req, res) => {
  const data = await beauticianService.getMyPlatformCommission(req.user.id);
  return ApiResponse.success(res, {
    message: 'Commission',
    data
  });
});

exports.getBankDetails = catchAsync(async (req, res) => {
  const profile = await BeauticianProfile.findOne({ user: req.user.id }).select('bankDetails');
  return ApiResponse.success(res, {
    message: 'Bank details',
    data: profile?.bankDetails || {}
  });
});

exports.updateBankDetails = catchAsync(async (req, res) => {
  const profile = await BeauticianProfile.findOneAndUpdate(
    { user: req.user.id },
    { bankDetails: req.body },
    { new: true, runValidators: true }
  );
  return ApiResponse.success(res, {
    message: 'Bank details updated',
    data: profile.bankDetails
  });
});

