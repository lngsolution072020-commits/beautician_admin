const ApiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const adminService = require('../services/admin.service');
const { buildFileUrl } = require('../utils/fileUrl');

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
  const { items, meta } = await adminService.getVendors(req.query, req.vendorScope);
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

// Banners
exports.createBanner = catchAsync(async (req, res) => {
  const payload = { ...req.body };
  if (req.file) {
    payload.imageUrl = req.file.filename;
  }
  if (!payload.imageUrl) {
    return ApiResponse.error(res, { statusCode: 400, message: 'Banner image is required (upload a file or provide imageUrl)' });
  }
  const bannerDoc = await adminService.createBanner(payload);
  const banner = bannerDoc.toObject ? bannerDoc.toObject() : bannerDoc;
  if (banner.imageUrl && !banner.imageUrl.startsWith('http')) {
    banner.imageUrl = buildFileUrl(req, 'banners', banner.imageUrl);
  }
  return ApiResponse.success(res, {
    message: 'Banner created',
    statusCode: 201,
    data: banner
  });
});

exports.getBanners = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getBanners(req.query);
  const mapped = items.map((b) => {
    const obj = b.toObject ? b.toObject() : b;
    if (obj.imageUrl && !obj.imageUrl.startsWith('http')) {
      obj.imageUrl = buildFileUrl(req, 'banners', obj.imageUrl);
    }
    return obj;
  });
  return ApiResponse.success(res, {
    message: 'Banners fetched',
    data: { items: mapped, meta }
  });
});

exports.updateBanner = catchAsync(async (req, res) => {
  const payload = { ...req.body };
  if (req.file) {
    payload.imageUrl = req.file.filename;
  }
  const bannerDoc = await adminService.updateBanner(req.params.id, payload);
  const banner = bannerDoc.toObject ? bannerDoc.toObject() : bannerDoc;
  if (banner.imageUrl && !banner.imageUrl.startsWith('http')) {
    banner.imageUrl = buildFileUrl(req, 'banners', banner.imageUrl);
  }
  return ApiResponse.success(res, {
    message: 'Banner updated',
    data: banner
  });
});

exports.deleteBanner = catchAsync(async (req, res) => {
  await adminService.deleteBanner(req.params.id);
  return ApiResponse.success(res, {
    message: 'Banner deleted',
    data: {}
  });
});

// Categories
exports.createCategory = catchAsync(async (req, res) => {
  const payload = { ...req.body };
  if (req.file) {
    payload.imageUrl = req.file.filename;
  }
  const categoryDoc = await adminService.createCategory(payload);
  const category = categoryDoc.toObject ? categoryDoc.toObject() : categoryDoc;
  if (category.imageUrl && !category.imageUrl.startsWith('http')) {
    category.imageUrl = buildFileUrl(req, 'categories', category.imageUrl);
  }
  return ApiResponse.success(res, {
    message: 'Category created',
    statusCode: 201,
    data: category
  });
});

exports.getCategories = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getCategories(req.query);
  const mapped = items.map((c) => {
    const obj = c.toObject ? c.toObject() : c;
    if (obj.imageUrl && !obj.imageUrl.startsWith('http')) {
      obj.imageUrl = buildFileUrl(req, 'categories', obj.imageUrl);
    }
    return obj;
  });
  return ApiResponse.success(res, {
    message: 'Categories fetched',
    data: { items: mapped, meta }
  });
});

exports.updateCategory = catchAsync(async (req, res) => {
  const payload = { ...req.body };
  if (req.file) {
    payload.imageUrl = req.file.filename;
  }
  const categoryDoc = await adminService.updateCategory(req.params.id, payload);
  const category = categoryDoc.toObject ? categoryDoc.toObject() : categoryDoc;
  if (category.imageUrl && !category.imageUrl.startsWith('http')) {
    category.imageUrl = buildFileUrl(req, 'categories', category.imageUrl);
  }
  return ApiResponse.success(res, {
    message: 'Category updated',
    data: category
  });
});

exports.deleteCategory = catchAsync(async (req, res) => {
  await adminService.deleteCategory(req.params.id);
  return ApiResponse.success(res, {
    message: 'Category deleted',
    data: {}
  });
});

// Services
exports.createService = catchAsync(async (req, res) => {
  const payload = { ...req.body };
  if (typeof payload.includes === 'string') {
    try {
      const parsed = JSON.parse(payload.includes);
      if (Array.isArray(parsed)) payload.includes = parsed;
    } catch {
      delete payload.includes;
    }
  }
  if (typeof payload.experts === 'string') {
    try {
      const parsed = JSON.parse(payload.experts);
      if (Array.isArray(parsed)) payload.experts = parsed;
    } catch {
      delete payload.experts;
    }
  }
  if (req.file) {
    payload.imageUrl = req.file.filename;
  }
  const serviceDoc = await adminService.createService(payload);
  const service = serviceDoc.toObject ? serviceDoc.toObject() : serviceDoc;
  if (service.imageUrl && !service.imageUrl.startsWith('http')) {
    service.imageUrl = buildFileUrl(req, 'services', service.imageUrl);
  }
  return ApiResponse.success(res, {
    message: 'Service created',
    statusCode: 201,
    data: service
  });
});

exports.getServices = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getServices(req.query);
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

exports.updateService = catchAsync(async (req, res) => {
  const payload = { ...req.body };
  if (typeof payload.includes === 'string') {
    try {
      const parsed = JSON.parse(payload.includes);
      if (Array.isArray(parsed)) payload.includes = parsed;
    } catch {
      delete payload.includes;
    }
  }
  if (typeof payload.experts === 'string') {
    try {
      const parsed = JSON.parse(payload.experts);
      if (Array.isArray(parsed)) payload.experts = parsed;
    } catch {
      delete payload.experts;
    }
  }
  if (req.file) {
    payload.imageUrl = req.file.filename;
  }
  if (payload.category !== undefined && payload.category === '') payload.category = null;
  const serviceDoc = await adminService.updateService(req.params.id, payload);
  const service = serviceDoc.toObject ? serviceDoc.toObject() : serviceDoc;
  if (service.imageUrl && !service.imageUrl.startsWith('http')) {
    service.imageUrl = buildFileUrl(req, 'services', service.imageUrl);
  }
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
  const { items, meta } = await adminService.getBeauticians(req.query, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Beauticians fetched',
    data: { items, meta }
  });
});

exports.createBeautician = catchAsync(async (req, res) => {
  const beautician = await adminService.createBeautician(req.body, req.vendorScope);
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
  const beautician = await adminService.updateBeautician(req.params.id, req.body, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Beautician updated',
    data: beautician
  });
});

// Users
exports.getUsers = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getUsers(req.query, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Users fetched',
    data: { items, meta }
  });
});

exports.getUserById = catchAsync(async (req, res) => {
  const user = await adminService.getUserById(req.params.id, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'User details',
    data: user
  });
});

exports.updateUser = catchAsync(async (req, res) => {
  const user = await adminService.updateUser(req.params.id, req.body, req.vendorScope);
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

exports.getPayments = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getPayments(req.query, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Payments fetched',
    data: { items, meta }
  });
});

exports.getBeauticianLiveLocation = catchAsync(async (req, res) => {
  const data = await adminService.getBeauticianLiveLocation(req.params.id, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Beautician live location fetched',
    data
  });
});

// Appointments / Orders
exports.getAppointments = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getAppointments(req.query, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Appointments fetched',
    data: { items, meta }
  });
});

exports.getAppointmentById = catchAsync(async (req, res) => {
  const appointment = await adminService.getAppointmentById(req.params.id, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Appointment fetched',
    data: appointment
  });
});

exports.updateAppointment = catchAsync(async (req, res) => {
  const appointment = await adminService.updateAppointment(req.params.id, req.body);
  return ApiResponse.success(res, {
    message: 'Appointment updated',
    data: appointment
  });
});

// Dashboard & Reports
exports.getDashboard = catchAsync(async (req, res) => {
  const dashboard = await adminService.getDashboard(req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Dashboard data',
    data: dashboard
  });
});

exports.getReports = catchAsync(async (req, res) => {
  const reports = await adminService.getReports(req.query, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Reports data',
    data: reports
  });
});

function mapInventoryItem(req, item) {
  const obj = item.toObject ? item.toObject() : { ...item };
  if (obj.imageUrl && !String(obj.imageUrl).startsWith('http')) {
    obj.imageUrl = buildFileUrl(req, 'inventory', obj.imageUrl);
  }
  return obj;
}

/** Normalize multipart (and JSON) body for inventory create/update */
function parseInventoryPayload(req) {
  const b = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  if (req.file?.filename) {
    b.imageUrl = req.file.filename;
  } else if (b.clearImage === 'true' || b.clearImage === true) {
    b.imageUrl = '';
  }
  delete b.clearImage;
  const num = (v) => {
    if (v === '' || v == null) return undefined;
    const x = Number(v);
    return Number.isFinite(x) ? x : undefined;
  };
  if (b.quantity !== undefined) {
    const q = num(b.quantity);
    b.quantity = q != null ? q : 0;
  }
  if (b.costPrice !== undefined) b.costPrice = num(b.costPrice);
  if (b.sellingPrice !== undefined) b.sellingPrice = num(b.sellingPrice);
  const toBool = (v, def) => {
    if (v === undefined || v === '') return def;
    if (v === true || v === 'true' || v === '1' || v === 'on') return true;
    if (v === false || v === 'false' || v === '0') return false;
    return def;
  };
  b.isActive = toBool(b.isActive, true);
  b.showInShop = toBool(b.showInShop, true);
  return b;
}

// Inventory & product orders (shop)
exports.getInventory = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getAdminInventory(req.query, req.vendorScope);
  const mapped = items.map((i) => mapInventoryItem(req, i));
  return ApiResponse.success(res, {
    message: 'Inventory',
    data: { items: mapped, meta }
  });
});

exports.createInventoryItem = catchAsync(async (req, res) => {
  const payload = parseInventoryPayload(req);
  const item = await adminService.createAdminInventoryItem(payload, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Inventory item created',
    statusCode: 201,
    data: mapInventoryItem(req, item)
  });
});

exports.updateInventoryItem = catchAsync(async (req, res) => {
  const payload = parseInventoryPayload(req);
  const item = await adminService.updateAdminInventoryItem(req.params.id, payload, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Inventory updated',
    data: mapInventoryItem(req, item)
  });
});

exports.deleteInventoryItem = catchAsync(async (req, res) => {
  await adminService.deleteAdminInventoryItem(req.params.id, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Inventory item deleted',
    data: {}
  });
});

exports.getProductOrders = catchAsync(async (req, res) => {
  const { items, meta } = await adminService.getAdminProductOrders(req.query, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Product orders',
    data: { items, meta }
  });
});

exports.updateProductOrderStatus = catchAsync(async (req, res) => {
  const order = await adminService.updateAdminProductOrderStatus(req.params.id, req.body.status, req.vendorScope);
  return ApiResponse.success(res, {
    message: 'Order updated',
    data: order
  });
});

