const City = require('../models/City');
const Vendor = require('../models/Vendor');
const Service = require('../models/Service');
const Category = require('../models/Category');
const Banner = require('../models/Banner');
const User = require('../models/User');
const BeauticianProfile = require('../models/BeauticianProfile');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const LocationTracking = require('../models/LocationTracking');
const ApiError = require('../utils/apiError');
const { getPagination, getMeta } = require('../utils/pagination');
const { ROLES, APPOINTMENT_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const { getDistanceInKm } = require('../utils/location');
const notificationService = require('./notification.service');

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

// Banner management
const createBanner = (payload) => Banner.create(payload);

const getBanners = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const [items, total] = await Promise.all([
    Banner.find({}).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Banner.countDocuments()
  ]);
  return { items, meta: getMeta({ page, limit, total }) };
};

const updateBanner = async (id, payload) => {
  const banner = await Banner.findByIdAndUpdate(id, payload, { new: true });
  if (!banner) throw new ApiError(404, 'Banner not found');
  return banner;
};

const deleteBanner = async (id) => {
  const banner = await Banner.findByIdAndDelete(id);
  if (!banner) throw new ApiError(404, 'Banner not found');
  return true;
};

// Category management
const createCategory = (payload) => Category.create(payload);

const getCategories = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }
  const [items, total] = await Promise.all([
    Category.find(filter).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Category.countDocuments(filter)
  ]);
  return { items, meta: getMeta({ page, limit, total }) };
};

const updateCategory = async (id, payload) => {
  const category = await Category.findByIdAndUpdate(id, payload, { new: true });
  if (!category) throw new ApiError(404, 'Category not found');
  return category;
};

const deleteCategory = async (id) => {
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new ApiError(404, 'Category not found');
  return true;
};

// Service management
const createService = (payload) => {
  const { category, ...rest } = payload;
  const doc = { ...rest };
  if (category) doc.category = category;
  return Service.create(doc);
};

const getServices = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }
  const [items, total] = await Promise.all([
    Service.find(filter).populate('category').skip(skip).limit(limit).sort({ createdAt: -1 }),
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
    const isAvailable = b.isAvailable !== false;
    let status = 'offline';
    if (busySet.has(uid)) status = 'busy';
    else if (isAvailable) status = 'online';
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
      status,
      completedToday: todayMap[uid] || 0
    };
  }).filter(Boolean);

  return { items: formatted, meta: getMeta({ page, limit, total: totalCount }) };
};

const getBeauticianById = async (userId) => {
  const user = await User.findOne({ _id: userId, role: ROLES.BEAUTICIAN })
    .select('-password')
    .populate('city')
    .populate('vendor')
    .lean();
  if (!user) throw new ApiError(404, 'Beautician not found');
  const profile = await BeauticianProfile.findOne({ user: userId }).populate('vendor').lean();
  if (!profile) throw new ApiError(404, 'Beautician profile not found');

  const [totalJobs, earningsResult, inProgressCount, completedToday] = await Promise.all([
    Appointment.countDocuments({ beautician: userId, status: APPOINTMENT_STATUS.COMPLETED }),
    Appointment.aggregate([
      { $match: { beautician: user._id, status: APPOINTMENT_STATUS.COMPLETED } },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]),
    Appointment.countDocuments({ beautician: userId, status: APPOINTMENT_STATUS.IN_PROGRESS }),
    Appointment.countDocuments({
      beautician: userId,
      status: APPOINTMENT_STATUS.COMPLETED,
      completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    })
  ]);

  const totalEarnings = (earningsResult && earningsResult[0] && earningsResult[0].total) || 0;
  const cityName = user.city && (typeof user.city === 'object' ? user.city.name : user.city);
  const vendorName = profile.vendor && (typeof profile.vendor === 'object' ? profile.vendor.name : profile.vendor);

  return {
    _id: profile._id,
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    city: cityName || '',
    cityId: user.city && (user.city._id || user.city).toString(),
    vendor: vendorName || '',
    vendorId: profile.vendor && (profile.vendor._id || profile.vendor).toString(),
    totalJobs,
    totalEarnings,
    walletBalance: profile.walletBalance != null ? profile.walletBalance : 0,
    rating: profile.rating != null ? profile.rating : 0,
    expertise: profile.expertise || [],
    experienceYears: profile.experienceYears != null ? profile.experienceYears : 0,
    isAvailable: profile.isAvailable !== false,
    kycStatus: profile.kycStatus || 'pending',
    documents: (profile.documents || []).map((d) => ({
      id: d._id.toString(),
      type: d.type,
      url: d.url,
      status: d.status,
      notes: d.notes || ''
    })),
    inProgressCount,
    completedToday,
    isActive: user.isActive !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

const updateBeautician = async (userId, payload) => {
  const user = await User.findOne({ _id: userId, role: ROLES.BEAUTICIAN });
  if (!user) throw new ApiError(404, 'Beautician not found');
  const profile = await BeauticianProfile.findOne({ user: userId });
  if (!profile) throw new ApiError(404, 'Beautician profile not found');

  if (payload.name !== undefined) user.name = payload.name.trim();
  if (payload.phone !== undefined) user.phone = payload.phone || '';
  if (payload.password !== undefined && payload.password.trim()) {
    user.password = payload.password.trim();
  }
  if (payload.isActive !== undefined) user.isActive = payload.isActive;
  if (payload.cityId !== undefined) user.city = payload.cityId || undefined;

  if (payload.rating !== undefined) profile.rating = Math.min(5, Math.max(0, Number(payload.rating)));
  if (payload.walletBalance !== undefined) profile.walletBalance = Math.max(0, Number(payload.walletBalance));
  if (payload.expertise !== undefined) profile.expertise = Array.isArray(payload.expertise) ? payload.expertise : profile.expertise;
  if (payload.experienceYears !== undefined) profile.experienceYears = Number(payload.experienceYears);
  if (payload.isAvailable !== undefined) profile.isAvailable = payload.isAvailable;
  if (payload.vendorId !== undefined) profile.vendor = payload.vendorId || undefined;

  if (payload.kycStatus !== undefined) profile.kycStatus = payload.kycStatus;
  if (Array.isArray(payload.documents)) {
    payload.documents.forEach((docUpdate) => {
      if (!docUpdate || !docUpdate.id) return;
      const existing = profile.documents.id(docUpdate.id);
      if (!existing) return;
      if (docUpdate.status !== undefined) existing.status = docUpdate.status;
      if (docUpdate.notes !== undefined) existing.notes = docUpdate.notes;
    });
  }

  await Promise.all([user.save(), profile.save()]);
  return getBeauticianById(userId);
};

// Users (all roles: customer, beautician, etc.)
const getUsers = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { role: { $in: [ROLES.CUSTOMER, ROLES.BEAUTICIAN] } };
  if (query.role) filter.role = query.role;
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
      { phone: { $regex: String(query.search).replace(/\s/g, ''), $options: 'i' } }
    ];
  }
  const [items, total] = await Promise.all([
    User.find(filter).select('-password').populate('city').skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
    User.countDocuments(filter)
  ]);
  const userIds = items.map((u) => u._id);
  const [beauticianProfiles, bookingsByCustomer, spentByCustomer, completedByBeautician] = await Promise.all([
    BeauticianProfile.find({ user: { $in: userIds } }).lean(),
    Appointment.aggregate([
      {
        $match: {
          customer: { $in: userIds },
          status: { $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.REJECTED] }
        }
      },
      { $group: { _id: '$customer', count: { $sum: 1 } } }
    ]),
    Appointment.aggregate([
      {
        $match: {
          customer: { $in: userIds },
          status: APPOINTMENT_STATUS.COMPLETED
        }
      },
      { $group: { _id: '$customer', total: { $sum: '$price' } } }
    ]),
    Appointment.aggregate([
      { $match: { beautician: { $in: userIds }, status: APPOINTMENT_STATUS.COMPLETED } },
      { $group: { _id: '$beautician', count: { $sum: 1 } } }
    ])
  ]);
  const profileByUser = Object.fromEntries((beauticianProfiles || []).map((p) => [p.user.toString(), p]));
  const bookingsMap = Object.fromEntries((bookingsByCustomer || []).map((c) => [c._id.toString(), c.count]));
  const spentMap = Object.fromEntries((spentByCustomer || []).map((s) => [s._id.toString(), s.total]));
  const beauticianJobsMap = Object.fromEntries((completedByBeautician || []).map((c) => [c._id.toString(), c.count]));

  const formatted = items.map((u) => {
    const uid = u._id.toString();
    const profile = profileByUser[uid];
    const cityName = u.city && (typeof u.city === 'object' ? u.city.name : u.city);
    return {
      _id: uid,
      id: uid,
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      city: cityName || '',
      isActive: u.isActive !== false,
      totalBookings: u.role === ROLES.CUSTOMER ? (bookingsMap[uid] || 0) : undefined,
      totalJobs: u.role === ROLES.BEAUTICIAN ? (beauticianJobsMap[uid] || 0) : undefined,
      totalSpent: u.role === ROLES.CUSTOMER ? (spentMap[uid] || 0) : undefined,
      rating: profile ? (profile.rating != null ? profile.rating : 0) : undefined,
      walletBalance: profile ? (profile.walletBalance != null ? profile.walletBalance : 0) : undefined,
      createdAt: u.createdAt
    };
  });
  return { items: formatted, meta: getMeta({ page, limit, total }) };
};

const getUserById = async (userId) => {
  const user = await User.findById(userId).select('-password').populate('city').lean();
  if (!user) throw new ApiError(404, 'User not found');
  const uid = user._id.toString();
  const cityName = user.city && (typeof user.city === 'object' ? user.city.name : user.city);

  if (user.role === ROLES.BEAUTICIAN) {
    return getBeauticianById(userId);
  }

  if (user.role === ROLES.CUSTOMER) {
    const [totalBookings, totalSpentResult] = await Promise.all([
      Appointment.countDocuments({
        customer: userId,
        status: { $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.REJECTED] }
      }),
      Appointment.aggregate([
        { $match: { customer: user._id, status: APPOINTMENT_STATUS.COMPLETED } },
        { $group: { _id: null, total: { $sum: '$price' } } }
      ])
    ]);
    const totalSpent = (totalSpentResult && totalSpentResult[0] && totalSpentResult[0].total) || 0;
    return {
      id: uid,
      _id: uid,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      city: cityName || '',
      isActive: user.isActive !== false,
      totalBookings,
      totalSpent,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  return {
    id: uid,
    _id: uid,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    city: cityName || '',
    isActive: user.isActive !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

const updateUser = async (userId, payload) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  if (payload.name !== undefined) user.name = payload.name.trim();
  if (payload.phone !== undefined) user.phone = payload.phone || '';
  if (payload.password !== undefined && payload.password.trim()) {
    user.password = payload.password.trim();
  }
  if (payload.isActive !== undefined) user.isActive = payload.isActive;
  await user.save();
  return getUserById(userId);
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
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      match.createdAt.$lte = toDate;
    }
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

const getBeauticianLiveLocation = async (userId) => {
  const user = await User.findOne({ _id: userId, role: ROLES.BEAUTICIAN }).populate('city').lean();
  if (!user) throw new ApiError(404, 'Beautician not found');

  const latest = await LocationTracking.findOne({ beautician: user._id })
    .sort({ recordedAt: -1 })
    .lean();
  if (!latest || !latest.location?.coordinates || latest.location.coordinates.length < 2) {
    return null;
  }

  const [lng, lat] = latest.location.coordinates;
  return {
    id: user._id.toString(),
    name: user.name,
    status: 'online',
    city: user.city?.name || '',
    lat,
    lng,
    recordedAt: latest.recordedAt
  };
};

const getPayments = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate('customer', 'name phone')
      .populate({
        path: 'appointment',
        populate: [
          { path: 'beautician', select: 'name phone' },
          { path: 'vendor', select: 'name' }
        ]
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter)
  ]);
  const mapped = items.map((p) => ({
    id: p._id.toString(),
    amount: p.amount || 0,
    status: p.status,
    customerName: p.customer?.name || '',
    beauticianName: p.appointment?.beautician?.name || '',
    vendorName: p.appointment?.vendor?.name || '',
    providerOrderId: p.providerOrderId || '',
    providerPaymentId: p.providerPaymentId || '',
    createdAt: p.createdAt
  }));
  return { items: mapped, meta: getMeta({ page, limit, total }) };
};

// Appointments list for admin – show which customer booked which beautician + beautician live distance
const getAppointments = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.status) filter.status = query.status;
  if (query.customerId) filter.customer = query.customerId;
  if (query.beauticianId) filter.beautician = query.beauticianId;

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .populate('customer beautician service')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    Appointment.countDocuments(filter)
  ]);

  const beauticianIds = [...new Set(items.map((a) => a.beautician?._id).filter(Boolean))];
  let lastLocationByBeautician = {};
  if (beauticianIds.length > 0) {
    const lastLocations = await LocationTracking.aggregate([
      { $match: { beautician: { $in: beauticianIds } } },
      { $sort: { recordedAt: -1 } },
      { $group: { _id: '$beautician', location: { $first: '$location' } } }
    ]);
    lastLocations.forEach((l) => {
      lastLocationByBeautician[l._id.toString()] = l.location;
    });
  }

  const formatted = items.map((a) => {
    const customer = a.customer || {};
    const beautician = a.beautician || {};
    const service = a.service || {};
    let distanceInKm = null;
    if (beautician._id && a.location?.coordinates?.length >= 2) {
      const lastLoc = lastLocationByBeautician[beautician._id.toString()];
      if (lastLoc?.coordinates?.length >= 2) {
        distanceInKm = getDistanceInKm(a.location, lastLoc);
      }
    }

    return {
      id: a._id.toString(),
      status: a.status,
      price: a.price,
      scheduledAt: a.scheduledAt,
      createdAt: a.createdAt,
      address: a.address,
      customer: {
        id: customer._id ? customer._id.toString() : undefined,
        name: customer.name || '',
        phone: customer.phone || ''
      },
      beautician: beautician._id
        ? {
            id: beautician._id.toString(),
            name: beautician.name || '',
            phone: beautician.phone || ''
          }
        : null,
      service: {
        id: service._id ? service._id.toString() : undefined,
        name: service.name || ''
      },
      distanceInKm
    };
  });

  return { items: formatted, meta: getMeta({ page, limit, total }) };
};

const getAppointmentById = async (id) => {
  const appointment = await Appointment.findById(id)
    .populate('customer beautician service')
    .lean();
  if (!appointment) throw new ApiError(404, 'Appointment not found');

  const customer = appointment.customer || {};
  const beautician = appointment.beautician || {};
  const service = appointment.service || {};
  let distanceInKm = null;
  if (beautician._id && appointment.location?.coordinates?.length >= 2) {
    const latest = await LocationTracking.findOne({ beautician: beautician._id })
      .sort({ recordedAt: -1 })
      .lean();
    if (latest?.location?.coordinates?.length >= 2) {
      distanceInKm = getDistanceInKm(appointment.location, latest.location);
    }
  }

  return {
    id: appointment._id.toString(),
    status: appointment.status,
    price: appointment.price,
    scheduledAt: appointment.scheduledAt,
    createdAt: appointment.createdAt,
    address: appointment.address,
    notes: appointment.notes,
    customer: {
      id: customer._id?.toString(),
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || ''
    },
    beautician: beautician._id
      ? {
          id: beautician._id.toString(),
          name: beautician.name || '',
          phone: beautician.phone || '',
          email: beautician.email || ''
        }
      : null,
    service: {
      id: service._id?.toString(),
      name: service.name || ''
    },
    distanceInKm
  };
};

const updateAppointment = async (id, payload) => {
  const appointment = await Appointment.findById(id);
  if (!appointment) throw new ApiError(404, 'Appointment not found');

  const previousBeauticianId = appointment.beautician ? appointment.beautician.toString() : null;

  if (payload.beautician !== undefined) {
    appointment.beautician = payload.beautician || null;

    // When admin assigns a beautician for a pending booking, mark it as accepted
    if (appointment.beautician && appointment.status === APPOINTMENT_STATUS.PENDING) {
      appointment.status = APPOINTMENT_STATUS.ACCEPTED;
    }
  }

  await appointment.save();

  // Notify beautician & customer when beautician assignment actually changes
  if (appointment.beautician && appointment.beautician.toString() !== previousBeauticianId) {
    const beauticianId = appointment.beautician;
    const customerId = appointment.customer;

    // Notify beautician about new job (reuse "appointment_created" type so existing app ringtone works)
    notificationService
      .sendFCM(beauticianId, {
        title: 'New job assigned',
        body: 'Admin has assigned you a new booking. Open app to view details.',
        data: {
          type: 'appointment_created',
          appointmentId: String(appointment._id)
        }
      })
      .catch(() => {});

    // Notify customer that a beautician has been assigned
    if (customerId) {
      notificationService
        .sendFCM(customerId, {
          title: 'Beautician assigned',
          body: 'A beautician has been assigned to your booking.',
          data: {
            type: 'appointment_assigned',
            appointmentId: String(appointment._id)
          }
        })
        .catch(() => {});
    }
  }

  return getAppointmentById(id);
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
  createBanner,
  getBanners,
  updateBanner,
  deleteBanner,
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  createService,
  getServices,
  updateService,
  deleteService,
  getBeauticians,
  getBeauticianById,
  updateBeautician,
  createBeautician,
  getUsers,
  getUserById,
  updateUser,
  getDashboard,
  getReports,
  getAlerts,
  getPayments,
  getBeauticianLiveLocation,
  getAppointments,
  getAppointmentById,
  updateAppointment
};

