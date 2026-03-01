const City = require('../models/City');
const Vendor = require('../models/Vendor');
const Service = require('../models/Service');
const User = require('../models/User');
const BeauticianProfile = require('../models/BeauticianProfile');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const LocationTracking = require('../models/LocationTracking');
const ApiError = require('../utils/apiError');
const { getPagination, getMeta } = require('../utils/pagination');
const { ROLES, APPOINTMENT_STATUS } = require('../utils/constants');

// City management
const createCity = async (payload) => {
  const name = payload.name.trim();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = await City.findOne({ name: { $regex: new RegExp(`^${escaped}$`, 'i') } });
  if (existing) throw new ApiError(409, 'A city with this name already exists');
  return City.create(payload);
};

const getCities = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }
  const [items, total] = await Promise.all([
    City.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    City.countDocuments(filter)
  ]);
  return { items, meta: getMeta({ page, limit, total }) };
};

const updateCity = async (id, payload) => {
  const city = await City.findByIdAndUpdate(id, payload, { new: true });
  if (!city) throw new ApiError(404, 'City not found');
  return city;
};

const deleteCity = async (id) => {
  const city = await City.findByIdAndDelete(id);
  if (!city) throw new ApiError(404, 'City not found');
  return true;
};

// Vendor management
const createVendor = (payload) => Vendor.create(payload);

const getVendors = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.cityId) filter.city = query.cityId;
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }
  const [items, total] = await Promise.all([
    Vendor.find(filter).populate('city').skip(skip).limit(limit).sort({ createdAt: -1 }),
    Vendor.countDocuments(filter)
  ]);
  return { items, meta: getMeta({ page, limit, total }) };
};

const getVendorById = async (id) => {
  const vendor = await Vendor.findById(id).populate('city');
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  return vendor;
};

const updateVendor = async (id, payload) => {
  const vendor = await Vendor.findByIdAndUpdate(id, payload, { new: true });
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  return vendor;
};

const deleteVendor = async (id) => {
  const vendor = await Vendor.findByIdAndDelete(id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  return true;
};

// Service management
const createService = (payload) => Service.create(payload);

const getServices = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }
  const [items, total] = await Promise.all([
    Service.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Service.countDocuments(filter)
  ]);
  return { items, meta: getMeta({ page, limit, total }) };
};

const updateService = async (id, payload) => {
  const service = await Service.findByIdAndUpdate(id, payload, { new: true });
  if (!service) throw new ApiError(404, 'Service not found');
  return service;
};

const deleteService = async (id) => {
  const service = await Service.findByIdAndDelete(id);
  if (!service) throw new ApiError(404, 'Service not found');
  return true;
};

// Beauticians (admin: all beauticians across vendors)
const getBeauticians = async (query) => {
  const { page, limit, skip } = getPagination(query);

  const userMatch = { role: ROLES.BEAUTICIAN };
  if (query.search) {
    userMatch.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { phone: { $regex: String(query.search).replace(/\s/g, ''), $options: 'i' } }
    ];
  }
  if (query.cityId) userMatch.city = query.cityId;

  const userIds = await User.find(userMatch).select('_id').lean();
  const userIdList = userIds.map((u) => u._id);
  const profileFilter = { user: { $in: userIdList } };
  const totalCount = await BeauticianProfile.countDocuments(profileFilter);

  const items = await BeauticianProfile.find(profileFilter)
    .populate({ path: 'user', populate: { path: 'city' } })
    .populate({ path: 'vendor', populate: { path: 'city' } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const beauticianIds = items.map((b) => b.user && b.user._id).filter(Boolean);
  const [inProgressAppointments, completedCounts, completedTodayCounts] = await Promise.all([
    Appointment.find({ beautician: { $in: beauticianIds }, status: APPOINTMENT_STATUS.IN_PROGRESS }).select('beautician').lean(),
    Appointment.aggregate([{ $match: { beautician: { $in: beauticianIds }, status: APPOINTMENT_STATUS.COMPLETED } }, { $group: { _id: '$beautician', count: { $sum: 1 } } }]),
    Appointment.aggregate([
      {
        $match: {
          beautician: { $in: beauticianIds },
          status: APPOINTMENT_STATUS.COMPLETED,
          completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      },
      { $group: { _id: '$beautician', count: { $sum: 1 } } }
    ])
  ]);
  const busySet = new Set(inProgressAppointments.map((a) => a.beautician.toString()));
  const completedMap = Object.fromEntries((completedCounts || []).map((c) => [c._id.toString(), c.count]));
  const todayMap = Object.fromEntries((completedTodayCounts || []).map((c) => [c._id.toString(), c.count]));

  const formatted = items.map((b) => {
    const u = b.user;
    if (!u) return null;
    const uid = u._id.toString();
    const cityName = u.city && (typeof u.city === 'object' ? u.city.name : u.city);
    const vendorName = b.vendor && (typeof b.vendor === 'object' ? b.vendor.name : b.vendor);
    return {
      _id: b._id,
      id: uid,
      name: u.name,
      phone: u.phone || '',
      city: cityName || '',
      vendor: vendorName || '',
      vendorId: b.vendor && b.vendor._id ? b.vendor._id.toString() : '',
      services: completedMap[uid] || 0,
      rating: b.rating != null ? b.rating : 0,
      status: busySet.has(uid) ? 'busy' : 'offline',
      completedToday: todayMap[uid] || 0
    };
  }).filter(Boolean);

  return { items: formatted, meta: getMeta({ page, limit, total: totalCount }) };
};

const createBeautician = async (payload) => {
  const { name, email, password, phone, vendorId, cityId } = payload;
  const vendor = await Vendor.findById(vendorId).populate('city');
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(400, 'Email already in use');

  const user = await User.create({
    name,
    email,
    password: password || 'ChangeMe123!',
    phone,
    role: ROLES.BEAUTICIAN,
    vendor: vendorId,
    city: cityId || vendor.city?._id || vendor.city
  });

  const beauticianProfile = await BeauticianProfile.create({
    user: user._id,
    vendor: vendorId
  });

  user.beauticianProfile = beauticianProfile._id;
  await user.save();

  const cityDoc = user.city && (await City.findById(user.city).lean()) ? await City.findById(user.city).lean() : vendor.city;
  return {
    _id: beauticianProfile._id,
    id: user._id.toString(),
    name: user.name,
    phone: user.phone || '',
    city: cityDoc?.name || (vendor.city?.name || ''),
    vendor: vendor.name,
    vendorId: vendor._id.toString(),
    services: 0,
    rating: 0,
    status: 'offline',
    completedToday: 0
  };
};

// Dashboard and reports (simplified aggregations)
const getDashboard = async () => {
  const [cities, vendors, services, appointments, payments, beauticianUsers, lastLocations, inProgressByBeautician, vendorRevenue, delayedAppointments, pendingPayments] = await Promise.all([
    City.countDocuments(),
    Vendor.countDocuments(),
    Service.countDocuments(),
    Appointment.countDocuments(),
    Payment.countDocuments({ status: 'paid' }),
    User.find({ role: ROLES.BEAUTICIAN }).select('name city').populate('city').lean(),
    LocationTracking.aggregate([{ $sort: { recordedAt: -1 } }, { $group: { _id: '$beautician', location: { $first: '$location' }, recordedAt: { $first: '$recordedAt' } } }]),
    Appointment.find({ status: APPOINTMENT_STATUS.IN_PROGRESS }).select('beautician').lean(),
    Payment.aggregate([
      { $match: { status: 'paid' } },
      { $lookup: { from: 'appointments', localField: 'appointment', foreignField: '_id', as: 'app' } },
      { $unwind: '$app' },
      { $group: { _id: '$app.vendor', totalAmount: { $sum: '$amount' } } },
      { $sort: { totalAmount: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'vendors', localField: '_id', foreignField: '_id', as: 'v' } },
      { $unwind: '$v' },
      { $lookup: { from: 'cities', localField: 'v.city', foreignField: '_id', as: 'c' } },
      { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'beauticianprofiles', localField: '_id', foreignField: 'vendor', as: 'bCount' } },
      { $project: { vendorId: '$_id', name: '$v.name', city: '$c.name', revenue: '$totalAmount', beauticians: { $size: '$bCount' }, growth: { $literal: 0 }, avatar: { $substr: ['$v.name', 0, 2] } } }
    ]),
    Appointment.find({
      status: APPOINTMENT_STATUS.IN_PROGRESS,
      startedAt: { $exists: true, $ne: null },
      $expr: { $gt: [{ $subtract: [new Date(), '$startedAt'] }, 45 * 60 * 1000] }
    }).populate({ path: 'beautician', populate: { path: 'city' } }).lean(),
    Payment.find({ status: 'pending' }).countDocuments()
  ]);

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const locationByBeautician = {};
  (lastLocations || []).forEach((l) => {
    locationByBeautician[l._id.toString()] = l;
  });
  const busySet = new Set((inProgressByBeautician || []).map((a) => a.beautician?.toString()).filter(Boolean));
  const liveBeauticians = (beauticianUsers || []).map((u) => {
    const uid = u._id.toString();
    const loc = locationByBeautician[uid];
    const coords = loc?.location?.coordinates;
    let status = 'offline';
    if (busySet.has(uid)) status = 'busy';
    else if (loc && new Date(loc.recordedAt) > fifteenMinAgo) status = 'online';
    return {
      id: uid,
      name: u.name,
      status,
      city: u.city?.name || (u.city && u.city.name) || '',
      lat: coords && coords[1] != null ? coords[1] : 19.076,
      lng: coords && coords[0] != null ? coords[0] : 72.877
    };
  });

  const recentAlerts = [];
  (delayedAppointments || []).slice(0, 5).forEach((a) => {
    recentAlerts.push({
      id: a._id.toString(),
      type: 'critical',
      title: 'Service Delay Alert',
      description: `Beautician ${a.beautician?.name || 'Unknown'} delayed`,
      time: 'Just now',
      city: a.beautician?.city?.name || ''
    });
  });
  if (pendingPayments > 0) {
    recentAlerts.push({
      id: 'payment-pending',
      type: 'warning',
      title: 'Payment Pending',
      description: `${pendingPayments} vendor settlements overdue`,
      time: 'Recently',
      city: ''
    });
  }
  if (recentAlerts.length === 0) {
    recentAlerts.push({
      id: 'info-1',
      type: 'info',
      title: 'System OK',
      description: 'No critical alerts',
      time: new Date().toISOString(),
      city: ''
    });
  }

  const topVendors = (vendorRevenue || []).map((v) => ({
    id: v.vendorId?.toString() || v._id?.toString(),
    name: v.name || 'Vendor',
    city: v.city || '',
    revenue: v.revenue || 0,
    beauticians: v.beauticians || 0,
    growth: v.growth != null ? v.growth : 0,
    avatar: (v.avatar || (v.name || 'V').substring(0, 2)).toUpperCase()
  }));

  return {
    totalCities: cities,
    totalVendors: vendors,
    totalServices: services,
    totalAppointments: appointments,
    totalPaidPayments: payments,
    liveBeauticians,
    recentAlerts,
    topVendors
  };
};

const getAlerts = async () => {
  const [delayed, pendingPayments] = await Promise.all([
    Appointment.find({
      status: APPOINTMENT_STATUS.IN_PROGRESS,
      startedAt: { $exists: true, $ne: null }
    })
      .populate('beautician')
      .lean(),
    Payment.find({ status: 'pending' }).lean()
  ]);

  const alerts = [];
  const now = Date.now();
  delayed.forEach((a) => {
    const started = a.startedAt ? new Date(a.startedAt).getTime() || 0 : 0;
    const mins = started ? Math.floor((now - started) / 60000) : 0;
    if (mins >= 45) {
      alerts.push({
        id: a._id.toString(),
        type: 'critical',
        title: 'Service Delay - Exceeded 45 mins',
        description: `Beautician ${a.beautician?.name || 'Unknown'} is delayed for appointment`,
        city: a.beautician?.city?.name || '',
        time: `${mins} min ago`,
        read: false
      });
    }
  });
  if (pendingPayments.length > 0) {
    alerts.push({
      id: 'payments-pending',
      type: 'warning',
      title: 'Payment Settlement Overdue',
      description: `${pendingPayments.length} vendor settlements pending`,
      city: '',
      time: 'Recently',
      read: false
    });
    alerts.push({
      id: 'info-system',
      type: 'info',
      title: 'System',
      description: 'Alerts are derived from appointments and payments',
      city: 'All',
      time: new Date().toLocaleString(),
      read: false
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      id: 'no-alerts',
      type: 'info',
      title: 'No critical alerts',
      description: 'All systems normal',
      city: 'All',
      time: new Date().toLocaleString(),
      read: false
    });
  }
  return alerts;
};

const getReports = async (query) => {
  const match = {};
  if (query.from || query.to) {
    match.createdAt = {};
    if (query.from) match.createdAt.$gte = new Date(query.from);
    if (query.to) match.createdAt.$lte = new Date(query.to);
  }

  const payments = await Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return { payments };
};

module.exports = {
  createCity,
  getCities,
  updateCity,
  deleteCity,
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  createService,
  getServices,
  updateService,
  deleteService,
  getBeauticians,
  createBeautician,
  getDashboard,
  getReports,
  getAlerts
};

