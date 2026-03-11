const ApiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const adminService = require('../services/admin.service');

// Cities
exports.createCity = catchAsync(async (req, res) => {
  const city = await adminService.createCity(req.body);
  return ApiResponse.success(res, {
    message: 'City created',
    statusCode: 201,
    data: city
  });
});

exports.getCities = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getCities(req.query);
  return ApiResponse.success(res, {
    message: 'Cities fetched',
    data: { items, meta }
  });
});

exports.updateCity = catchAsync(async (req, res) => {
  const city = await adminService.updateCity(req.params.id, req.body);
  return ApiResponse.success(res, {
    message: 'City updated',
    data: city
  });
});

exports.deleteCity = catchAsync(async (req, res) => {
  await adminService.deleteCity(req.params.id);
  return ApiResponse.success(res, {
    message: 'City deleted',
    data: {}
  });
});

// Vendors
exports.createVendor = catchAsync(async (req, res) => {
  const vendor = await adminService.createVendor(req.body);
  return ApiResponse.success(res, {
    message: 'Vendor created',
    statusCode: 201,
    data: vendor
  });
});

exports.getVendors = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getVendors(req.query);
  return ApiResponse.success(res, {
    message: 'Vendors fetched',
    data: { items, meta }
  });
});

exports.getVendorById = catchAsync(async (req, res) => {
  const vendor = await adminService.getVendorById(req.params.id);
  return ApiResponse.success(res, {
    message: 'Vendor fetched',
    data: vendor
  });
});

exports.updateVendor = catchAsync(async (req, res) => {
  const vendor = await adminService.updateVendor(req.params.id, req.body);
  return ApiResponse.success(res, {
    message: 'Vendor updated',
    data: vendor
  });
});

exports.deleteVendor = catchAsync(async (req, res) => {
  await adminService.deleteVendor(req.params.id);
  return ApiResponse.success(res, {
    message: 'Vendor deleted',
    data: {}
  });
});

// Services
exports.createService = catchAsync(async (req, res) => {
  const payload = { ...req.body };
  if (req.file) {
    payload.imageUrl = `${req.protocol}://${req.get('host')}/uploads/services/${req.file.filename}`;
  }
  const service = await adminService.createService(payload);
  return ApiResponse.success(res, {
    message: 'Service created',
    statusCode: 201,
    data: service
  });
});

exports.getServices = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getServices(req.query);
  return ApiResponse.success(res, {
    message: 'Services fetched',
    data: { items, meta }
  });
});

exports.updateService = catchAsync(async (req, res) => {
  const payload = { ...req.body };
  if (req.file) {
    payload.imageUrl = `${req.protocol}://${req.get('host')}/uploads/services/${req.file.filename}`;
  }
  const service = await adminService.updateService(req.params.id, payload);
  return ApiResponse.success(res, {
    message: 'Service updated',
    data: service
  });
});

exports.deleteService = catchAsync(async (req, res) => {
  await adminService.deleteService(req.params.id);
  return ApiResponse.success(res, {
    message: 'Service deleted',
    data: {}
  });
});

// Beauticians
exports.getBeauticians = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getBeauticians(req.query);
  return ApiResponse.success(res, {
    message: 'Beauticians fetched',
    data: { items, meta }
  });
});

exports.createBeautician = catchAsync(async (req, res) => {
  const beautician = await adminService.createBeautician(req.body);
  return ApiResponse.success(res, {
    message: 'Beautician created',
    statusCode: 201,
    data: beautician
  });
});

exports.getBeauticianById = catchAsync(async (req, res) => {
  const beautician = await adminService.getBeauticianById(req.params.id);
  return ApiResponse.success(res, {
    message: 'Beautician details',
    data: beautician
  });
});

exports.updateBeautician = catchAsync(async (req, res) => {
  const beautician = await adminService.updateBeautician(req.params.id, req.body);
  return ApiResponse.success(res, {
    message: 'Beautician updated',
    data: beautician
  });
});

// Users
exports.getUsers = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getUsers(req.query);
  return ApiResponse.success(res, {
    message: 'Users fetched',
    data: { items, meta }
  });
});

exports.getUserById = catchAsync(async (req, res) => {
  const user = await adminService.getUserById(req.params.id);
  return ApiResponse.success(res, {
    message: 'User details',
    data: user
  });
});

exports.updateUser = catchAsync(async (req, res) => {
  const user = await adminService.updateUser(req.params.id, req.body);
  return ApiResponse.success(res, {
    message: 'User updated',
    data: user
  });
});

// Alerts
exports.getAlerts = catchAsync(async (req, res) => {
  const alerts = await adminService.getAlerts();
  return ApiResponse.success(res, {
    message: 'Alerts fetched',
    data: alerts
  });
});

// Dashboard & Reports
exports.getDashboard = catchAsync(async (req, res) => {
  const dashboard = await adminService.getDashboard();
  return ApiResponse.success(res, {
    message: 'Dashboard data',
    data: dashboard
  });
});

exports.getReports = catchAsync(async (req, res) => {
  const reports = await adminService.getReports(req.query);
  return ApiResponse.success(res, {
    message: 'Reports data',
    data: reports
  });
});

