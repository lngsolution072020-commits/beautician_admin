const env = require('../config/env');
const logger = require('../config/logger');
const Service = require('../models/Service');
const Banner = require('../models/Banner');
const Category = require('../models/Category');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const LocationTracking = require('../models/LocationTracking');
const CustomerProfile = require('../models/CustomerProfile');
const Inventory = require('../models/Inventory');
const ProductOrder = require('../models/ProductOrder');
const Vendor = require('../models/Vendor');
const razorpayService = require('./razorpay.service');
const BeauticianProfile = require('../models/BeauticianProfile');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const {
  ROLES,
  APPOINTMENT_STATUS,
  PAYMENT_STATUS,
  PRODUCT_ORDER_STATUS
} = require('../utils/constants');
const { getPagination, getMeta } = require('../utils/pagination');
const { buildPoint, getEtaBetweenPoints } = require('../utils/location');
const appointmentRatingService = require('./appointmentRating.service');
const appointmentOfferService = require('./appointmentOffer.service');

// Ensure date fields are valid ISO strings so client never gets "Invalid Date" / Invalid time value
function sanitizeAppointmentForResponse(doc) {
  const obj = doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const dateFields = [
    'scheduledAt',
    'createdAt',
    'updatedAt',
    'startedAt',
    'completedAt',
    'offerExpiresAt',
    'serviceStartOtpExpiresAt'
  ];
  dateFields.forEach((field) => {
    if (obj[field] != null) {
      const d = obj[field] instanceof Date ? obj[field] : new Date(obj[field]);
      obj[field] = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }
  });
  delete obj.serviceStartOtp;
  if (obj.paymentMode != null && obj.paymentMode !== '') {
    obj.paymentMode = String(obj.paymentMode).trim().toLowerCase();
  }
  return obj;
}

// Banners for customer app (active only)
const getBanners = async () => {
  const items = await Banner.find({ isActive: true }).sort({ order: 1, createdAt: -1 }).lean();
  return { items };
};

// Categories for customer app (active only)
const getCategories = async () => {
  const items = await Category.find({ isActive: true }).sort({ order: 1, createdAt: -1 }).lean();
  return { items };
};

// Services listing for customers (with category populated)
const getServices = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { isActive: true };
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }

  const [items, total] = await Promise.all([
    Service.find(filter).populate('category').skip(skip).limit(limit).sort({ createdAt: -1 }),
    Service.countDocuments(filter)
  ]);

  return { items, meta: getMeta({ page, limit, total }) };
};

const getServiceById = async (id) => {
  const service = await Service.findOne({ _id: id, isActive: true }).populate('category').lean();
  if (!service) throw new ApiError(404, 'Service not found');
  return service;
};

// Booking – ensure scheduledAt is a valid date to avoid "Invalid time value" on serialization
const createAppointment = async (customerId, payload) => {
  const {
    serviceId,
    scheduledAt: rawScheduledAt,
    address,
    lat,
    lng,
    price,
    paymentMode = 'online',
    beauticianUserId: preferredBeauticianUserId
  } = payload;

  const service = await Service.findById(serviceId);
  if (!service) throw new ApiError(404, 'Service not found');

  const scheduledAt = rawScheduledAt instanceof Date ? rawScheduledAt : new Date(rawScheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new ApiError(400, 'Invalid date/time for booking. Please select a valid date and time.');
  }

  const pendingRatings = await appointmentRatingService.countPendingCustomerRatings(customerId);
  if (pendingRatings > 0) {
    throw new ApiError(
      400,
      'Please rate your beautician for completed services before booking again.'
    );
  }

  if (paymentMode === 'wallet') {
    const profile = await CustomerProfile.findOne({ user: customerId });
    if (!profile) throw new ApiError(400, 'Customer profile not found');
    const bal = profile.walletBalance != null ? profile.walletBalance : 0;
    if (bal < price) {
      throw new ApiError(400, 'Insufficient wallet balance');
    }
  }

  const appointment = await Appointment.create({
    customer: customerId,
    service: serviceId,
    scheduledAt,
    address,
    location: buildPoint(lat, lng),
    price,
    paymentMode
  });

  if (paymentMode === 'wallet') {
    const profile = await CustomerProfile.findOne({ user: customerId });
    if (!profile) {
      appointment.status = APPOINTMENT_STATUS.CANCELLED;
      await appointment.save();
      throw new ApiError(400, 'Customer profile not found');
    }
    const bal = profile.walletBalance != null ? profile.walletBalance : 0;
    if (bal < price) {
      appointment.status = APPOINTMENT_STATUS.CANCELLED;
      await appointment.save();
      throw new ApiError(400, 'Insufficient wallet balance');
    }
    profile.walletBalance = bal - price;
    await profile.save();
  }

  try {
    await appointmentOfferService.assignInitialOffer(
      appointment,
      customerId,
      preferredBeauticianUserId,
      service.name
    );
    if (!appointment.beautician) {
      logger.warn(
        'No available beautician for booking %s (customer %s). Admin can assign manually.',
        appointment._id,
        customerId
      );
    }
  } catch (e) {
    logger.warn('Auto-assign / notify beautician failed for booking %s: %s', appointment._id, e.message);
  }

  return sanitizeAppointmentForResponse(appointment);
};

const getAppointments = async (customerId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { customer: customerId };
  if (query.status) filter.status = query.status;

  const [rawItems, total] = await Promise.all([
    Appointment.find(filter)
      .select('-serviceStartOtp -serviceStartOtpExpiresAt')
      .populate('service beautician')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    Appointment.countDocuments(filter)
  ]);

  const items = await Promise.all(
    rawItems.map(async (item) => {
      const sanitized = sanitizeAppointmentForResponse(item);
      if (sanitized.beautician && sanitized.beautician._id) {
        const [servicesCompleted, profile] = await Promise.all([
          Appointment.countDocuments({ beautician: sanitized.beautician._id, status: APPOINTMENT_STATUS.COMPLETED }),
          BeauticianProfile.findOne({ user: sanitized.beautician._id }).lean()
        ]);
        sanitized.beautician = {
          ...sanitized.beautician,
          servicesCompleted,
          rating: profile?.rating || 4.5,
          experienceYears: profile?.experienceYears || 0
        };
      }
      return sanitized;
    })
  );
  return { items, meta: getMeta({ page, limit, total }) };
};

const getAppointmentById = async (customerId, id) => {
  const appt = await Appointment.findById(id).populate('service beautician');
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (String(appt.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden: appointment does not belong to customer');
  }
  const sanitized = sanitizeAppointmentForResponse(appt);
  if (sanitized.beautician && sanitized.beautician._id) {
    const [servicesCompleted, profile] = await Promise.all([
      Appointment.countDocuments({ beautician: sanitized.beautician._id, status: APPOINTMENT_STATUS.COMPLETED }),
      BeauticianProfile.findOne({ user: sanitized.beautician._id }).lean()
    ]);
    sanitized.beautician = {
      ...sanitized.beautician,
      servicesCompleted,
      rating: profile?.rating || 4.5,
      experienceYears: profile?.experienceYears || 0
    };
  }
  if (
    sanitized.status === APPOINTMENT_STATUS.REACHED &&
    appt.serviceStartOtp &&
    appt.serviceStartOtpExpiresAt &&
    new Date(appt.serviceStartOtpExpiresAt) > new Date()
  ) {
    sanitized.serviceStartOtp = appt.serviceStartOtp;
    sanitized.serviceStartOtpExpiresAt = new Date(appt.serviceStartOtpExpiresAt).toISOString();
  } else {
    delete sanitized.serviceStartOtpExpiresAt;
  }
  return sanitized;
};

const cancelAppointment = async (customerId, id) => {
  const appt = await Appointment.findById(id);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (String(appt.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden: appointment does not belong to customer');
  }
  if (
    ![
      APPOINTMENT_STATUS.PENDING,
      APPOINTMENT_STATUS.ACCEPTED,
      APPOINTMENT_STATUS.IN_TRANSIT,
      APPOINTMENT_STATUS.REACHED
      // not in_progress: service already underway
    ].includes(appt.status)
  ) {
    throw new ApiError(400, 'This appointment can no longer be cancelled');
  }
  appt.serviceStartOtp = null;
  appt.serviceStartOtpExpiresAt = null;
  appt.status = APPOINTMENT_STATUS.CANCELLED;
  await appt.save();
  return sanitizeAppointmentForResponse(appt);
};

// Tracking: latest beautician location + ETA placeholder
const trackAppointment = async (customerId, appointmentId) => {
  const appt = await Appointment.findById(appointmentId).populate('beautician');
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (String(appt.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden: appointment does not belong to customer');
  }

  if (
    ![
      APPOINTMENT_STATUS.ACCEPTED,
      APPOINTMENT_STATUS.IN_TRANSIT,
      APPOINTMENT_STATUS.REACHED,
      APPOINTMENT_STATUS.IN_PROGRESS
    ].includes(appt.status)
  ) {
    throw new ApiError(400, 'Tracking is allowed only for active appointments');
  }

  const latestLocation = await LocationTracking.findOne({
    beautician: appt.beautician,
    appointment: appt.id
  }).sort({ recordedAt: -1 });

  if (!latestLocation) {
    throw new ApiError(404, 'No location data available yet');
  }

  const [lng, lat] = appt.location.coordinates;
  const [bLng, bLat] = latestLocation.location.coordinates;

  const eta = await getEtaBetweenPoints({
    origin: { lat: bLat, lng: bLng },
    destination: { lat, lng }
  });

  return {
    beauticianLocation: latestLocation.location,
    eta
  };
};

async function creditCustomerWallet(userId, amountRupees) {
  const profile = await CustomerProfile.findOne({ user: userId });
  if (!profile) throw new ApiError(404, 'Customer profile not found');
  const add = Number(amountRupees);
  if (!Number.isFinite(add) || add <= 0) return profile;
  profile.walletBalance = (profile.walletBalance != null ? profile.walletBalance : 0) + add;
  await profile.save();
  return profile;
}

async function decrementInventoryForProductOrder(po) {
  for (const line of po.items) {
    const inv = await Inventory.findById(line.inventoryItem);
    if (!inv) throw new ApiError(400, 'A product in this order is no longer available');
    if (inv.quantity < line.quantity) {
      throw new ApiError(400, `Insufficient stock for ${line.name}. Please contact support.`);
    }
    inv.quantity -= line.quantity;
    await inv.save();
  }
}

// Shop: products in customer's city (vendor inventory marked for shop)
const getShopProducts = async (customerId, query) => {
  const { page, limit, skip } = getPagination(query);
  const user = await User.findById(customerId).select('city').lean();
  if (!user?.city) {
    return { items: [], meta: getMeta({ page, limit, total: 0 }) };
  }
  const vendorIds = await Vendor.find({ city: user.city, isActive: true }).distinct('_id');
  if (!vendorIds.length) {
    return { items: [], meta: getMeta({ page, limit, total: 0 }) };
  }
  const filter = {
    vendor: { $in: vendorIds },
    isActive: true,
    showInShop: true,
    quantity: { $gt: 0 },
    sellingPrice: { $gt: 0 }
  };
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }
  const [items, total] = await Promise.all([
    Inventory.find(filter).populate('vendor', 'name').skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
    Inventory.countDocuments(filter)
  ]);
  return { items, meta: getMeta({ page, limit, total }) };
};

const createProductOrder = async (customerId, payload) => {
  const { items: rawItems, address, lat, lng, paymentMode: rawMode } = payload;
  const paymentMode = ['online', 'cod', 'wallet'].includes(rawMode) ? rawMode : 'online';

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, 'Add at least one product');
  }

  const user = await User.findById(customerId).select('city').lean();
  if (!user?.city) {
    throw new ApiError(400, 'Set your city in profile before ordering products');
  }

  const lines = [];
  let vendorId = null;
  let totalAmount = 0;

  for (const row of rawItems) {
    const invId = row.inventoryItemId || row.inventoryItem;
    const inv = await Inventory.findById(invId);
    if (!inv || !inv.isActive || !inv.showInShop) {
      throw new ApiError(404, 'Product not found or not available');
    }
    const vendorDoc = await Vendor.findById(inv.vendor).lean();
    if (!vendorDoc || !vendorDoc.isActive) throw new ApiError(400, 'Vendor unavailable');
    if (String(vendorDoc.city) !== String(user.city)) {
      throw new ApiError(400, 'Product is not available in your city');
    }
    const vId = String(inv.vendor);
    if (vendorId == null) vendorId = vId;
    else if (vendorId !== vId) {
      throw new ApiError(400, 'All items must be from the same salon (checkout separately otherwise)');
    }

    const qty = Math.max(1, Math.floor(Number(row.quantity)));
    if (inv.quantity < qty) {
      throw new ApiError(400, `Not enough stock for ${inv.name}`);
    }
    const unit = Number(inv.sellingPrice);
    if (!Number.isFinite(unit) || unit <= 0) {
      throw new ApiError(400, 'Product is not priced for sale');
    }
    const lineTotal = Math.round(unit * qty * 100) / 100;
    totalAmount += lineTotal;
    lines.push({
      inventoryItem: inv._id,
      name: inv.name,
      sku: inv.sku || '',
      unitPrice: unit,
      quantity: qty,
      lineTotal
    });
  }

  totalAmount = Math.round(totalAmount * 100) / 100;
  const addr = String(address || '').trim();
  if (addr.length < 5) throw new ApiError(400, 'Please enter a valid delivery address');

  let status = PRODUCT_ORDER_STATUS.PENDING_PAYMENT;
  if (paymentMode === 'online') {
    status = PRODUCT_ORDER_STATUS.PENDING_PAYMENT;
  } else if (paymentMode === 'wallet') {
    const profile = await CustomerProfile.findOne({ user: customerId });
    if (!profile) throw new ApiError(400, 'Customer profile not found');
    const bal = profile.walletBalance != null ? profile.walletBalance : 0;
    if (bal < totalAmount) throw new ApiError(400, 'Insufficient wallet balance');
    profile.walletBalance = bal - totalAmount;
    await profile.save();
    status = PRODUCT_ORDER_STATUS.CONFIRMED;
    await decrementInventoryForProductOrder({ items: lines });
  } else if (paymentMode === 'cod') {
    status = PRODUCT_ORDER_STATUS.CONFIRMED;
    await decrementInventoryForProductOrder({ items: lines });
  }

  const order = await ProductOrder.create({
    customer: customerId,
    vendor: vendorId,
    items: lines,
    address: addr,
    location:
      lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
        ? { type: 'Point', coordinates: [Number(lng), Number(lat)] }
        : undefined,
    totalAmount,
    paymentMode,
    status
  });

  if (paymentMode === 'wallet') {
    await Payment.create({
      paymentType: 'product_order',
      productOrder: order._id,
      appointment: null,
      customer: customerId,
      amount: totalAmount,
      status: PAYMENT_STATUS.PAID
    });
  }

  return order;
};

const getProductOrders = async (customerId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { customer: customerId };
  const [items, total] = await Promise.all([
    ProductOrder.find(filter).populate('vendor', 'name').skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
    ProductOrder.countDocuments(filter)
  ]);
  return { items, meta: getMeta({ page, limit, total }) };
};

const getProductOrderById = async (customerId, id) => {
  const order = await ProductOrder.findById(id).populate('vendor', 'name').lean();
  if (!order) throw new ApiError(404, 'Order not found');
  if (String(order.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden');
  }
  return order;
};

const cancelProductOrder = async (customerId, id) => {
  const order = await ProductOrder.findById(id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (String(order.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden');
  }
  if (order.status !== PRODUCT_ORDER_STATUS.PENDING_PAYMENT || order.paymentMode !== 'online') {
    throw new ApiError(400, 'This order cannot be cancelled');
  }
  await ProductOrder.deleteOne({ _id: id });
  return true;
};

// Razorpay: create order + pending Payment (appointment or product checkout)
const initiatePayment = async (customerId, { appointmentId, productOrderId }) => {
  if (productOrderId) {
    const po = await ProductOrder.findById(productOrderId);
    if (!po) throw new ApiError(404, 'Order not found');
    if (String(po.customer) !== String(customerId)) {
      throw new ApiError(403, 'Forbidden');
    }
    if (po.status !== PRODUCT_ORDER_STATUS.PENDING_PAYMENT) {
      throw new ApiError(400, 'Order is not awaiting online payment');
    }
    if (po.paymentMode !== 'online') {
      throw new ApiError(400, 'This order does not use online payment');
    }

    const amountRupees = Number(po.totalAmount);
    if (!Number.isFinite(amountRupees) || amountRupees < 1) {
      throw new ApiError(400, 'Invalid amount for payment');
    }

    if (!razorpayService.isConfigured()) {
      throw new ApiError(
        503,
        'Online payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test or live keys from Razorpay Dashboard).'
      );
    }

    const rz = razorpayService.getClient();
    const amountPaise = razorpayService.rupeesToPaise(amountRupees);
    const receipt = `p_${String(po._id)}_${Date.now()}`.slice(0, 40);

    let order;
    try {
      order = await rz.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          type: 'product_order',
          productOrderId: String(po._id),
          customerId: String(customerId)
        }
      });
    } catch (e) {
      const msg = e?.error?.description || e?.message || 'Razorpay order failed';
      throw new ApiError(502, msg);
    }

    const payment = await Payment.create({
      paymentType: 'product_order',
      productOrder: po.id,
      appointment: null,
      customer: customerId,
      amount: amountRupees,
      providerOrderId: order.id
    });

    return {
      paymentId: payment.id,
      orderId: order.id,
      amount: amountRupees,
      amountPaise,
      currency: 'INR',
      keyId: env.razorpay.keyId,
      mode: razorpayService.getRazorpayMode()
    };
  }

  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (String(appt.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden: appointment does not belong to customer');
  }

  const amountRupees = Number(appt.price);
  if (!Number.isFinite(amountRupees) || amountRupees < 1) {
    throw new ApiError(400, 'Invalid amount for payment');
  }

  if (!razorpayService.isConfigured()) {
    throw new ApiError(
      503,
      'Online payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test or live keys from Razorpay Dashboard).'
    );
  }

  const rz = razorpayService.getClient();
  const amountPaise = razorpayService.rupeesToPaise(amountRupees);
  const receipt = `a_${String(appt._id)}_${Date.now()}`.slice(0, 40);

  let order;
  try {
    order = await rz.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        type: 'appointment',
        appointmentId: String(appt._id),
        customerId: String(customerId)
      }
    });
  } catch (e) {
    const msg = e?.error?.description || e?.message || 'Razorpay order failed';
    throw new ApiError(502, msg);
  }

  const payment = await Payment.create({
    paymentType: 'appointment',
    appointment: appt.id,
    customer: customerId,
    amount: amountRupees,
    providerOrderId: order.id
  });

  return {
    paymentId: payment.id,
    orderId: order.id,
    amount: amountRupees,
    amountPaise,
    currency: 'INR',
    keyId: env.razorpay.keyId,
    mode: razorpayService.getRazorpayMode()
  };
};

const initiateWalletRecharge = async (customerId, { amount }) => {
  const amountRupees = Number(amount);
  if (!Number.isFinite(amountRupees) || amountRupees < 1 || amountRupees > 500000) {
    throw new ApiError(400, 'Amount must be between ₹1 and ₹5,00,000');
  }

  if (!razorpayService.isConfigured()) {
    throw new ApiError(
      503,
      'Online payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test or live keys from Razorpay Dashboard).'
    );
  }

  const rz = razorpayService.getClient();
  const amountPaise = razorpayService.rupeesToPaise(amountRupees);
  const receipt = `w_${String(customerId)}_${Date.now()}`.slice(0, 40);

  let order;
  try {
    order = await rz.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        type: 'wallet_recharge',
        customerId: String(customerId)
      }
    });
  } catch (e) {
    const msg = e?.error?.description || e?.message || 'Razorpay order failed';
    throw new ApiError(502, msg);
  }

  const payment = await Payment.create({
    paymentType: 'wallet_recharge',
    appointment: null,
    customer: customerId,
    amount: amountRupees,
    providerOrderId: order.id
  });

  return {
    paymentId: payment.id,
    orderId: order.id,
    amount: amountRupees,
    amountPaise,
    currency: 'INR',
    keyId: env.razorpay.keyId,
    mode: razorpayService.getRazorpayMode()
  };
};

const verifyPayment = async (customerId, { paymentId, providerPaymentId, providerSignature }) => {
  const payment = await Payment.findById(paymentId).populate('appointment').populate('productOrder');
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (String(payment.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden: payment does not belong to customer');
  }

  if (payment.status === PAYMENT_STATUS.PAID) {
    return payment;
  }

  const valid = razorpayService.verifyPaymentSignature(
    payment.providerOrderId,
    providerPaymentId,
    providerSignature
  );
  if (!valid) {
    payment.status = PAYMENT_STATUS.FAILED;
    await payment.save();
    throw new ApiError(400, 'Invalid payment signature');
  }

  payment.providerPaymentId = providerPaymentId;
  payment.providerSignature = providerSignature;
  payment.status = PAYMENT_STATUS.PAID;

  if (payment.paymentType === 'wallet_recharge') {
    await creditCustomerWallet(customerId, payment.amount);
  }

  if (payment.paymentType === 'product_order' && payment.productOrder) {
    const po = await ProductOrder.findById(payment.productOrder._id || payment.productOrder);
    if (po && po.status === PRODUCT_ORDER_STATUS.PENDING_PAYMENT) {
      await decrementInventoryForProductOrder(po);
      po.status = PRODUCT_ORDER_STATUS.CONFIRMED;
      await po.save();
    }
  }

  await payment.save();
  return payment;
};

const getInvoices = async (customerId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { customer: customerId, status: PAYMENT_STATUS.PAID };

  const [items, total] = await Promise.all([
    Payment.find(filter).populate('appointment').skip(skip).limit(limit).sort({ createdAt: -1 }),
    Payment.countDocuments(filter)
  ]);

  return { items, meta: getMeta({ page, limit, total }) };
};

const getBeauticianSummaryForCustomer = async (customerId, beauticianUserId) => {
  const shared = await Appointment.findOne({
    customer: customerId,
    beautician: beauticianUserId
  })
    .select('_id')
    .lean();
  if (!shared) {
    throw new ApiError(403, 'You have no bookings with this beautician');
  }

  const beauticianUser = await User.findOne({
    _id: beauticianUserId,
    role: ROLES.BEAUTICIAN,
    isActive: true
  })
    .select('name phone profileImage')
    .lean();
  if (!beauticianUser) throw new ApiError(404, 'Beautician not found');

  const profile = await BeauticianProfile.findOne({ user: beauticianUserId }).lean();
  const servicesCompleted = await Appointment.countDocuments({
    beautician: beauticianUserId,
    status: APPOINTMENT_STATUS.COMPLETED
  });

  return {
    id: beauticianUser._id.toString(),
    name: beauticianUser.name,
    phone: beauticianUser.phone || '',
    profileImage: beauticianUser.profileImage || '',
    rating: profile?.rating != null ? profile.rating : 0,
    experienceYears: profile?.experienceYears != null ? profile.experienceYears : 0,
    expertise: profile?.expertise || [],
    servicesCompleted
  };
};

const getPendingRatingsForCustomer = async (customerId) => {
  const items = await Appointment.find({
    customer: customerId,
    status: APPOINTMENT_STATUS.COMPLETED,
    'ratingFromCustomer.stars': { $exists: false }
  })
    .populate('beautician', 'name')
    .populate('service', 'name')
    .sort({ completedAt: -1 })
    .lean();

  return { items };
};

const submitCustomerRating = async (customerId, appointmentId, { stars, comment }) => {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (String(appt.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden');
  }
  if (appt.status !== APPOINTMENT_STATUS.COMPLETED) {
    throw new ApiError(400, 'You can rate only after the service is completed');
  }
  if (appt.ratingFromCustomer && appt.ratingFromCustomer.stars != null) {
    throw new ApiError(400, 'You have already submitted a rating');
  }
  const s = Math.min(5, Math.max(1, Math.round(Number(stars))));
  if (!Number.isFinite(s)) throw new ApiError(400, 'Invalid rating');
  appt.ratingFromCustomer = {
    stars: s,
    comment: comment ? String(comment).trim().slice(0, 500) : '',
    createdAt: new Date()
  };
  await appt.save();
  if (appt.beautician) {
    await appointmentRatingService.recalculateBeauticianAverageRating(appt.beautician);
  }
  return sanitizeAppointmentForResponse(appt);
};

module.exports = {
  getBanners,
  getCategories,
  getServices,
  getServiceById,
  createAppointment,
  getBeauticianSummaryForCustomer,
  getAppointments,
  getAppointmentById,
  cancelAppointment,
  trackAppointment,
  getPendingRatingsForCustomer,
  submitCustomerRating,
  getShopProducts,
  createProductOrder,
  getProductOrders,
  getProductOrderById,
  cancelProductOrder,
  initiatePayment,
  initiateWalletRecharge,
  verifyPayment,
  getInvoices
};

