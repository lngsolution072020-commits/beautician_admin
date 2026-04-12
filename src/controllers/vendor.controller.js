const ApiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const vendorService = require('../services/vendor.service');

// Beautician management
exports.createBeautician = catchAsync(async (req, res) => {
  const result = await vendorService.createBeautician(req.user.vendor, req.body);
  return ApiResponse.success(res, {
    message: 'Beautician created',
    statusCode: 201,
    data: result
  });
});

exports.getBeauticians = catchAsync(async (req, res) => {
  const { items, meta } = await vendorService.getBeauticians(req.user.vendor, req.query);
  return ApiResponse.success(res, {
    message: 'Beauticians fetched',
    data: { items, meta }
  });
});

exports.getCityUsers = catchAsync(async (req, res) => {
  const { items, meta } = await vendorService.getCityUsers(req.user.vendor, req.query);
  return ApiResponse.success(res, {
    message: 'City users fetched',
    data: { items, meta }
  });
});

exports.updateBeautician = catchAsync(async (req, res) => {
  const profile = await vendorService.updateBeautician(req.user.vendor, req.params.id, req.body);
  return ApiResponse.success(res, {
    message: 'Beautician updated',
    data: profile
  });
});

exports.deleteBeautician = catchAsync(async (req, res) => {
  await vendorService.deleteBeautician(req.user.vendor, req.params.id);
  return ApiResponse.success(res, {
    message: 'Beautician deleted',
    data: {}
  });
});

// Appointments
exports.getAppointments = catchAsync(async (req, res) => {
  const { items, meta } = await vendorService.getAppointments(req.user.vendor, req.query);
  return ApiResponse.success(res, {
    message: 'Appointments fetched',
    data: { items, meta }
  });
});

exports.getAppointmentById = catchAsync(async (req, res) => {
  const appt = await vendorService.getAppointmentById(req.user.vendor, req.params.id);
  return ApiResponse.success(res, {
    message: 'Appointment fetched',
    data: appt
  });
});

exports.assignBeautician = catchAsync(async (req, res) => {
  const { beauticianId } = req.body;
  const appt = await vendorService.assignBeautician(
    req.user.vendor,
    req.params.id,
    beauticianId
  );
  return ApiResponse.success(res, {
    message: 'Beautician assigned successfully',
    data: appt
  });
});

// Inventory
exports.createInventoryItem = catchAsync(async (req, res) => {
  const item = await vendorService.createInventoryItem(req.user.vendor, req.body);
  return ApiResponse.success(res, {
    message: 'Inventory item created',
    statusCode: 201,
    data: item
  });
});

exports.getInventory = catchAsync(async (req, res) => {
  const { items, meta } = await vendorService.getInventory(req.user.vendor, req.query);
  return ApiResponse.success(res, {
    message: 'Inventory fetched',
    data: { items, meta }
  });
});

exports.updateInventoryItem = catchAsync(async (req, res) => {
  const item = await vendorService.updateInventoryItem(req.user.vendor, req.params.id, req.body);
  return ApiResponse.success(res, {
    message: 'Inventory item updated',
    data: item
  });
});

exports.deleteInventoryItem = catchAsync(async (req, res) => {
  await vendorService.deleteInventoryItem(req.user.vendor, req.params.id);
  return ApiResponse.success(res, {
    message: 'Inventory item deleted',
    data: {}
  });
});

// Earnings & reports
exports.getEarnings = catchAsync(async (req, res) => {
  const earnings = await vendorService.getEarnings(req.user.vendor, req.query);
  return ApiResponse.success(res, {
    message: 'Earnings summary',
    data: earnings
  });
});

exports.getReports = catchAsync(async (req, res) => {
  const reports = await vendorService.getReports(req.user.vendor, req.query);
  return ApiResponse.success(res, {
    message: 'Vendor reports',
    data: reports
  });
});

