const env = require('../config/env');
const logger = require('../config/logger');
const Service = require('../models/Service');
const Banner = require('../models/Banner');
const Category = require('../models/Category');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const LocationTracking = require('../models/LocationTracking');
const CustomerProfile = require('../models/CustomerProfile');
const razorpayService = require('./razorpay.service');
const BeauticianProfile = require('../models/BeauticianProfile');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { ROLES, APPOINTMENT_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const { getPagination, getMeta } = require('../utils/pagination');
const { buildPoint, getEtaBetweenPoints } = require('../utils/location');
const notificationService = require('./notification.service');
const appointmentRatingService = require('./appointmentRating.service');

// Ensure date fields are valid ISO strings so client never gets "Invalid Date" / Invalid time value
function sanitizeAppointmentForResponse(doc) {
  const obj = doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const dateFields = ['scheduledAt', 'createdAt', 'updatedAt', 'startedAt', 'completedAt'];
  dateFields.forEach((field) => {
    if (obj[field] != null) {
      const d = obj[field] instanceof Date ? obj[field] : new Date(obj[field]);
      obj[field] = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }
  });
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

/**
 * Pick beautician for a new booking: optional preferred user id, else best match among
 * isAvailable + active beauticians (same city as customer when possible, KYC approved first).
 */
const pickBeauticianForBooking = async (customerId, preferredBeauticianUserId) => {
  const customer = await User.findById(customerId).select('city').lean();
  const customerCityId = customer?.city ? String(customer.city) : null;

  if (preferredBeauticianUserId) {
    const prefId = String(preferredBeauticianUserId).trim();
    const user = await User.findById(prefId).select('role isActive city').lean();
    if (user && user.role === ROLES.BEAUTICIAN && user.isActive) {
      const profile = await BeauticianProfile.findOne({ user: prefId }).populate({
        path: 'user',
        select: 'role isActive city',
        match: { role: ROLES.BEAUTICIAN, isActive: true }
      });
      if (profile?.user && profile.kycStatus !== 'rejected') {
        const okCity =
          !customerCityId || !user.city || String(user.city) === customerCityId;
        if (okCity) return profile;
      }
    }
    logger.warn('Preferred beautician %s not usable; auto-assigning another expert', prefId);
  }

  const list = await BeauticianProfile.find({
    isAvailable: true,
    kycStatus: { $in: ['approved', 'pending'] }
  })
    .populate({
      path: 'user',
      select: 'role isActive city',
      match: { role: ROLES.BEAUTICIAN, isActive: true }
    })
    .sort({ rating: -1, updatedAt: -1 })
    .limit(120);

  const cityOk = (p) =>
    p.user && (!customerCityId || !p.user.city || String(p.user.city) === customerCityId);

  const approvedInCity = list.filter((p) => p.kycStatus === 'approved' && cityOk(p));
  if (approvedInCity.length) return approvedInCity[0];

  const approvedAny = list.filter((p) => p.kycStatus === 'approved' && p.user);
  if (approvedAny.length) return approvedAny[0];

  const pendingInCity = list.filter((p) => p.kycStatus === 'pending' && cityOk(p));
  if (pendingInCity.length) return pendingInCity[0];

  const pendingAny = list.filter((p) => p.kycStatus === 'pending' && p.user);
  return pendingAny[0] || null;
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

  // Auto-assign beautician + FCM (type appointment_created → in-app ring + list refresh on beautician web app)
  try {
    const profile = await pickBeauticianForBooking(customerId, preferredBeauticianUserId);
    if (profile?.user) {
      appointment.beautician = profile.user._id;
      await appointment.save();
      const sent = await notificationService.sendFCM(profile.user._id, {
        title: 'New booking request',
        body: `${service.name} — open app to view and accept.`,
        data: {
          type: 'appointment_created',
          appointmentId: String(appointment._id)
        }
      });
      if (!sent) {
        logger.warn(
          'Booking %s assigned to beautician %s but FCM was not sent (token / Firebase).',
          appointment._id,
          profile.user._id
        );
      }
    } else {
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
  return sanitized;
};

const cancelAppointment = async (customerId, id) => {
  const appt = await Appointment.findById(id);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (String(appt.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden: appointment does not belong to customer');
  }
  if (![APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.ACCEPTED].includes(appt.status)) {
    throw new ApiError(400, 'Only pending or accepted appointments can be cancelled');
  }
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

  if (![APPOINTMENT_STATUS.ACCEPTED, APPOINTMENT_STATUS.IN_PROGRESS].includes(appt.status)) {
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

// Razorpay: create order + pending Payment (appointment checkout)
const initiatePayment = async (customerId, { appointmentId }) => {
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
  const payment = await Payment.findById(paymentId).populate('appointment');
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
  initiatePayment,
  initiateWalletRecharge,
  verifyPayment,
  getInvoices
};

