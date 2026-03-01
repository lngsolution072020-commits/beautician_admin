const ApiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const customerService = require('../services/customer.service');

// Services
exports.getServices = catchAsync(async (req, res) => {
  const { items, meta } = await customerService.getServices(req.query);
  return ApiResponse.success(res, {
    message: 'Services fetched',
    data: { items, meta }
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

