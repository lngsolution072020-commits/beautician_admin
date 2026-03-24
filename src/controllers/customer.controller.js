const ApiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const customerService = require('../services/customer.service');
const { buildFileUrl } = require('../utils/fileUrl');

// Banners & Categories (for home screen)
exports.getBanners = catchAsync(async (req, res) => {
  const { items } = await customerService.getBanners();
  const mapped = items.map((b) => {
    const obj = b.toObject ? b.toObject() : b;
    if (obj.imageUrl && !obj.imageUrl.startsWith('http')) {
      obj.imageUrl = buildFileUrl(req, 'banners', obj.imageUrl);
    }
    return obj;
  });
  return ApiResponse.success(res, {
    message: 'Banners fetched',
    data: { items: mapped }
  });
});

exports.getCategories = catchAsync(async (req, res) => {
  const { items } = await customerService.getCategories();
  const mapped = items.map((c) => {
    const obj = c.toObject ? c.toObject() : c;
    if (obj.imageUrl && !obj.imageUrl.startsWith('http')) {
      obj.imageUrl = buildFileUrl(req, 'categories', obj.imageUrl);
    }
    return obj;
  });
  return ApiResponse.success(res, {
    message: 'Categories fetched',
    data: { items: mapped }
  });
});

// Services
exports.getServices = catchAsync(async (req, res) => {
  const { items, meta } = await customerService.getServices(req.query);
  const mapped = items.map((s) => {
    const obj = s.toObject ? s.toObject() : s;
    if (obj.imageUrl && !obj.imageUrl.startsWith('http')) {
      obj.imageUrl = buildFileUrl(req, 'services', obj.imageUrl);
    }
    return obj;
  });
  return ApiResponse.success(res, {
    message: 'Services fetched',
    data: { items: mapped, meta }
  });
});

exports.getServiceById = catchAsync(async (req, res) => {
  const service = await customerService.getServiceById(req.params.id);
  const obj = service.toObject ? service.toObject() : { ...service };
  if (obj.imageUrl && !obj.imageUrl.startsWith('http')) {
    obj.imageUrl = buildFileUrl(req, 'services', obj.imageUrl);
  }
  return ApiResponse.success(res, {
    message: 'Service fetched',
    data: obj
  });
});

// Booking
exports.createAppointment = catchAsync(async (req, res) => {
  const appt = await customerService.createAppointment(req.user.id, req.body);
  return ApiResponse.success(res, {
    message: 'Appointment created',
    statusCode: 201,
    data: appt
  });
});

exports.getAppointments = catchAsync(async (req, res) => {
  const { items, meta } = await customerService.getAppointments(req.user.id, req.query);
  return ApiResponse.success(res, {
    message: 'Customer appointments fetched',
    data: { items, meta }
  });
});

exports.getAppointmentById = catchAsync(async (req, res) => {
  const appt = await customerService.getAppointmentById(req.user.id, req.params.id);
  return ApiResponse.success(res, {
    message: 'Appointment fetched',
    data: appt
  });
});

exports.cancelAppointment = catchAsync(async (req, res) => {
  const appt = await customerService.cancelAppointment(req.user.id, req.params.id);
  return ApiResponse.success(res, {
    message: 'Appointment cancelled',
    data: appt
  });
});

// Tracking
exports.trackAppointment = catchAsync(async (req, res) => {
  const tracking = await customerService.trackAppointment(req.user.id, req.params.appointmentId);
  return ApiResponse.success(res, {
    message: 'Tracking data',
    data: tracking
  });
});

// Payments
exports.initiatePayment = catchAsync(async (req, res) => {
  const payment = await customerService.initiatePayment(req.user.id, req.body);
  return ApiResponse.success(res, {
    message: 'Payment initiated',
    data: payment
  });
});

exports.verifyPayment = catchAsync(async (req, res) => {
  const payment = await customerService.verifyPayment(req.user.id, req.body);
  return ApiResponse.success(res, {
    message: 'Payment verified',
    data: payment
  });
});

exports.getInvoices = catchAsync(async (req, res) => {
  const { items, meta } = await customerService.getInvoices(req.user.id, req.query);
  return ApiResponse.success(res, {
    message: 'Invoices fetched',
    data: { items, meta }
  });
});

