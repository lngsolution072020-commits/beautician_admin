const ApiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const customerService = require('../services/customer.service');
const referralService = require('../services/referral.service');
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

function attachBeauticianProfileImageUrl(req, item) {
  if (!item || !item.beautician) return item;
  const b = item.beautician;
  const img = b.profileImage;
  if (img && String(img).trim() && !String(img).startsWith('http')) {
    return {
      ...item,
      beautician: { ...b, profileImageUrl: buildFileUrl(req, 'profiles', img) }
    };
  }
  return item;
}

function mapShopInventoryItem(req, item) {
  const obj = item.toObject ? item.toObject() : { ...item };
  if (obj.imageUrl && !String(obj.imageUrl).startsWith('http')) {
    obj.imageUrl = buildFileUrl(req, 'inventory', obj.imageUrl);
  }
  return obj;
}

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
  const mapped = items.map((row) => attachBeauticianProfileImageUrl(req, row));
  return ApiResponse.success(res, {
    message: 'Customer appointments fetched',
    data: { items: mapped, meta }
  });
});

exports.getAppointmentById = catchAsync(async (req, res) => {
  const appt = await customerService.getAppointmentById(req.user.id, req.params.id);
  return ApiResponse.success(res, {
    message: 'Appointment fetched',
    data: attachBeauticianProfileImageUrl(req, appt)
  });
});

exports.getBeauticianSummary = catchAsync(async (req, res) => {
  const summary = await customerService.getBeauticianSummaryForCustomer(req.user.id, req.params.id);
  const profileImageUrl =
    summary.profileImage && String(summary.profileImage).trim()
      ? buildFileUrl(req, 'profiles', summary.profileImage)
      : null;
  return ApiResponse.success(res, {
    message: 'Beautician profile',
    data: { ...summary, profileImageUrl }
  });
});

// Shop (e-commerce — same inventory as salon, filtered by customer city)
exports.getShopProducts = catchAsync(async (req, res) => {
  const { items, meta } = await customerService.getShopProducts(req.user.id, req.query);
  const mapped = items.map((i) => mapShopInventoryItem(req, i));
  return ApiResponse.success(res, {
    message: 'Shop products',
    data: { items: mapped, meta }
  });
});

exports.createProductOrder = catchAsync(async (req, res) => {
  const order = await customerService.createProductOrder(req.user.id, req.body);
  return ApiResponse.success(res, {
    message: 'Order created',
    statusCode: 201,
    data: order
  });
});

exports.getProductOrders = catchAsync(async (req, res) => {
  const { items, meta } = await customerService.getProductOrders(req.user.id, req.query);
  return ApiResponse.success(res, {
    message: 'Product orders',
    data: { items, meta }
  });
});

exports.getProductOrderById = catchAsync(async (req, res) => {
  const order = await customerService.getProductOrderById(req.user.id, req.params.id);
  return ApiResponse.success(res, {
    message: 'Product order',
    data: order
  });
});

exports.cancelProductOrder = catchAsync(async (req, res) => {
  await customerService.cancelProductOrder(req.user.id, req.params.id);
  return ApiResponse.success(res, {
    message: 'Order cancelled',
    data: {}
  });
});

exports.cancelAppointment = catchAsync(async (req, res) => {
  const appt = await customerService.cancelAppointment(req.user.id, req.params.id);
  return ApiResponse.success(res, {
    message: 'Appointment cancelled',
    data: appt
  });
});

exports.getPendingRatings = catchAsync(async (req, res) => {
  const data = await customerService.getPendingRatingsForCustomer(req.user.id);
  return ApiResponse.success(res, {
    message: 'Pending ratings',
    data
  });
});

exports.rateAppointment = catchAsync(async (req, res) => {
  const appt = await customerService.submitCustomerRating(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, {
    message: 'Thank you for your feedback',
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

exports.initiateWalletRecharge = catchAsync(async (req, res) => {
  const data = await customerService.initiateWalletRecharge(req.user.id, req.body);
  return ApiResponse.success(res, {
    message: 'Wallet recharge initiated',
    data
  });
});

exports.getInvoices = catchAsync(async (req, res) => {
  const { items, meta } = await customerService.getInvoices(req.user.id, req.query);
  return ApiResponse.success(res, {
    message: 'Invoices fetched',
    data: { items, meta }
  });
});

exports.getReferral = catchAsync(async (req, res) => {
  const data = await referralService.getReferralInfoForUser(req.user.id);
  return ApiResponse.success(res, {
    message: 'Referral',
    data
  });
});

