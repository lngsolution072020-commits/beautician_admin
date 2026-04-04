const mongoose = require('mongoose');
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
const Inventory = require('../models/Inventory');
const ProductOrder = require('../models/ProductOrder');
const ApiError = require('../utils/apiError');
const { getPagination, getMeta } = require('../utils/pagination');
const { ROLES, APPOINTMENT_STATUS, PAYMENT_STATUS, PRODUCT_ORDER_STATUS } = require('../utils/constants');
const { getDistanceInKm } = require('../utils/location');
const notificationService = require('./notification.service');

function clampPlatformCommissionPercent(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 10;
  return Math.min(100, Math.max(0, n));
}

/** Appointments visible to a vendor admin: same city (customer or beautician) or vendor id on booking */
async function buildVendorAppointmentMatch(vendorScope) {
  if (!vendorScope) return {};
  const { cityId, vendorId } = vendorScope;
  const cityUsers = await User.find({ city: cityId }).select('_id').lean();
  const ids = cityUsers.map((u) => u._id);
  return {
    $or: [{ customer: { $in: ids } }, { beautician: { $in: ids } }, { vendor: vendorId }]
  };
}

async function assertUserInVendorCity(userId, vendorScope) {
  if (!vendorScope) return;
  const u = await User.findById(userId).select('city').lean();
  if (!u || !u.city || String(u.city) !== String(vendorScope.cityId)) {
    throw new ApiError(403, 'Forbidden');
  }
}

// City management
const createCity = async (payload) => {
  const name = payload.name.trim();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = await City.findOne({ name: { $regex: new RegExp(`^${escaped}$`, 'i') } });
  if (existing) throw new ApiError(409, 'A city with this name already exists');
  const doc = { ...payload, name };
  if (payload.latitude != null) doc.latitude = Number(payload.latitude);
  if (payload.longitude != null) doc.longitude = Number(payload.longitude);
  if (payload.googlePlaceId) doc.googlePlaceId = String(payload.googlePlaceId).trim();
  return City.create(doc);
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
const createVendor = async (payload) => {
  const { panelPassword, ...rest } = payload;
  const email = rest.email.toLowerCase().trim();
  const existingUser = await User.findOne({ email });
  if (existingUser) throw new ApiError(400, 'Email already in use');
  const existingVendorEmail = await Vendor.findOne({ email });
  if (existingVendorEmail) throw new ApiError(400, 'Vendor email already exists');

  const vendor = await Vendor.create({ ...rest, email });
  const pwd =
    panelPassword && String(panelPassword).trim().length >= 6
      ? String(panelPassword).trim()
      : `Vendor${Math.floor(1000 + Math.random() * 9000)}!`;
  await User.create({
    name: rest.name,
    email,
    password: pwd,
    phone: rest.phone,
    role: ROLES.VENDOR,
    vendor: vendor._id,
    city: rest.city
  });
  return Vendor.findById(vendor._id).populate('city');
};

const getVendors = async (query, vendorScope) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (vendorScope) {
    filter._id = vendorScope.vendorId;
  } else if (query.cityId) filter.city = query.cityId;
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }
  const [items, total] = await Promise.all([
    Vendor.find(filter).populate('city').skip(skip).limit(limit).sort({ createdAt: -1 }),
    Vendor.countDocuments(filter)
  ]);
  return { items, meta: getMeta({ page, limit, total }) };
};

const getVendorById = async (id, vendorScope) => {
  if (vendorScope && String(id) !== String(vendorScope.vendorId)) {
    throw new ApiError(403, 'Forbidden');
  }
  const vendor = await Vendor.findById(id).populate('city');
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  return vendor;
};

const updateVendor = async (id, payload) => {
  const { panelPassword, email, ...rest } = payload;
  const vendor = await Vendor.findById(id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');

  if (email !== undefined) {
    const em = String(email).toLowerCase().trim();
    const linkedUser = await User.findOne({ vendor: id, role: ROLES.VENDOR });
    const userClash = await User.findOne({ email: em });
    if (userClash && linkedUser && String(userClash._id) !== String(linkedUser._id)) {
      throw new ApiError(400, 'Email already in use');
    }
    const vClash = await Vendor.findOne({ email: em, _id: { $ne: id } });
    if (vClash) throw new ApiError(400, 'Email already used by another vendor');
    vendor.email = em;
  }
  if (rest.name !== undefined) vendor.name = rest.name.trim();
  if (rest.phone !== undefined) vendor.phone = rest.phone || '';
  if (rest.address !== undefined) vendor.address = rest.address || '';
  if (rest.isActive !== undefined) vendor.isActive = rest.isActive;
  if (rest.city !== undefined) vendor.city = rest.city;
  // Vendor commission: % of beauticians' earnings credited to this vendor (see Vendor model).
  if (rest.platformCommissionPercent !== undefined) {
    vendor.platformCommissionPercent = clampPlatformCommissionPercent(rest.platformCommissionPercent);
  }
  await vendor.save();

  let linkedUser = await User.findOne({ vendor: id, role: ROLES.VENDOR });
  if (!linkedUser && panelPassword && String(panelPassword).trim().length >= 6) {
    linkedUser = await User.create({
      name: vendor.name,
      email: vendor.email,
      password: String(panelPassword).trim(),
      role: ROLES.VENDOR,
      vendor: vendor._id,
      city: vendor.city
    });
  } else if (linkedUser) {
    if (panelPassword !== undefined && String(panelPassword).trim().length >= 6) {
      linkedUser.password = String(panelPassword).trim();
    }
    if (email !== undefined) linkedUser.email = vendor.email;
    if (rest.name !== undefined) linkedUser.name = vendor.name;
    if (rest.city !== undefined) linkedUser.city = rest.city;
    await linkedUser.save();
  }

  return Vendor.findById(id).populate('city');
};

const deleteVendor = async (id) => {
  const vendor = await Vendor.findByIdAndDelete(id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  await User.deleteMany({ vendor: id, role: ROLES.VENDOR });
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
  /** Active = not explicitly false (matches customer/admin UI: isActive !== false) */
  const activeFilter = { ...filter, isActive: { $ne: false } };
  const [items, total, activeTotal, avgAgg] = await Promise.all([
    Service.find(filter).populate('category').skip(skip).limit(limit).sort({ createdAt: -1 }),
    Service.countDocuments(filter),
    Service.countDocuments(activeFilter),
    Service.aggregate([
      { $match: filter },
      { $group: { _id: null, avgPrice: { $avg: '$basePrice' } } }
    ])
  ]);
  const avgBasePrice =
    avgAgg[0] && typeof avgAgg[0].avgPrice === 'number' && !Number.isNaN(avgAgg[0].avgPrice)
      ? Math.round(avgAgg[0].avgPrice)
      : 0;
  return {
    items,
    meta: { ...getMeta({ page, limit, total }), activeTotal, avgBasePrice }
  };
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
const getBeauticians = async (query, vendorScope) => {
  const { page, limit, skip } = getPagination(query);

  const userMatch = { role: ROLES.BEAUTICIAN };
  if (query.search) {
    userMatch.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { phone: { $regex: String(query.search).replace(/\s/g, ''), $options: 'i' } }
    ];
  }
  const cityFilter = vendorScope ? String(vendorScope.cityId) : query.cityId;
  if (cityFilter) userMatch.city = cityFilter;

  let profileFilter;
  if (query.vendorId) {
    profileFilter = { vendor: query.vendorId };
    if (query.search || cityFilter) {
      const userIds = await User.find(userMatch).select('_id').lean();
      const userIdList = userIds.map((u) => u._id);
      if (userIdList.length === 0) {
        return { items: [], meta: getMeta({ page, limit, total: 0 }) };
      }
      profileFilter.user = { $in: userIdList };
    }
  } else {
    const userIds = await User.find(userMatch).select('_id').lean();
    const userIdList = userIds.map((u) => u._id);
    profileFilter = { user: { $in: userIdList } };
  }
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

const getBeauticianById = async (userId, vendorScope) => {
  const user = await User.findOne({ _id: userId, role: ROLES.BEAUTICIAN })
    .select('-password')
    .populate('city')
    .populate('vendor')
    .lean();
  if (!user) throw new ApiError(404, 'Beautician not found');
  if (vendorScope) {
    if (!user.city || String(user.city) !== String(vendorScope.cityId)) {
      throw new ApiError(403, 'Forbidden');
    }
  }
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
    platformCommissionPercent: clampPlatformCommissionPercent(profile.platformCommissionPercent),
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

const updateBeautician = async (userId, payload, vendorScope) => {
  if (vendorScope) {
    throw new ApiError(403, 'Forbidden');
  }
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
  if (payload.platformCommissionPercent !== undefined) {
    profile.platformCommissionPercent = clampPlatformCommissionPercent(payload.platformCommissionPercent);
  }
  if (Array.isArray(payload.documents) && payload.documents.length > 0) {
    payload.documents.forEach((docUpdate) => {
      if (!docUpdate || !docUpdate.id) return;
      const idStr = String(docUpdate.id).toLowerCase();
      if (!mongoose.Types.ObjectId.isValid(idStr)) return;
      const oid = new mongoose.Types.ObjectId(idStr);
      const existing = profile.documents.find((d) => d._id && d._id.equals(oid));
      if (!existing) return;
      if (docUpdate.status !== undefined) existing.status = docUpdate.status;
      if (docUpdate.notes !== undefined) existing.notes = docUpdate.notes;
    });
    // Ensure nested array changes are persisted (Mongoose can miss in-place subdoc edits)
    profile.markModified('documents');
  }

  await Promise.all([user.save(), profile.save()]);
  return getBeauticianById(userId, null);
};

// Users (all roles: customer, beautician, etc.)
const getUsers = async (query, vendorScope) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { role: { $in: [ROLES.CUSTOMER, ROLES.BEAUTICIAN] } };
  if (vendorScope) {
    filter.city = vendorScope.cityId;
  }
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

const getUserById = async (userId, vendorScope) => {
  const user = await User.findById(userId).select('-password').populate('city').lean();
  if (!user) throw new ApiError(404, 'User not found');
  if (vendorScope) {
    await assertUserInVendorCity(userId, vendorScope);
  }
  const uid = user._id.toString();
  const cityName = user.city && (typeof user.city === 'object' ? user.city.name : user.city);

  if (user.role === ROLES.BEAUTICIAN) {
    return getBeauticianById(userId, vendorScope);
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

const updateUser = async (userId, payload, vendorScope) => {
  if (vendorScope) {
    throw new ApiError(403, 'Forbidden');
  }
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  if (payload.name !== undefined) user.name = payload.name.trim();
  if (payload.phone !== undefined) user.phone = payload.phone || '';
  if (payload.password !== undefined && payload.password.trim()) {
    user.password = payload.password.trim();
  }
  if (payload.isActive !== undefined) user.isActive = payload.isActive;
  await user.save();
  return getUserById(userId, null);
};

const createBeautician = async (payload, vendorScope) => {
  if (vendorScope) {
    throw new ApiError(403, 'Forbidden');
  }
  const { name, email, password, phone, vendorId, cityId, platformCommissionPercent } = payload;
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
    vendor: vendorId,
    ...(platformCommissionPercent !== undefined
      ? { platformCommissionPercent: clampPlatformCommissionPercent(platformCommissionPercent) }
      : {})
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
async function getDashboardVendorScoped(vs) {
  const scopeMatch = await buildVendorAppointmentMatch(vs);
  const cityId = vs.cityId;
  const vendorId = vs.vendorId;

  const scopedApptIds = (await Appointment.find(scopeMatch).select('_id').lean()).map((a) => a._id);
  const cityUserIds = (await User.find({ city: cityId }).select('_id').lean()).map((u) => u._id);
  const beauticianIdsInCity = (await User.find({ role: ROLES.BEAUTICIAN, city: cityId }).select('_id').lean()).map((u) => u._id);

  const [
    customersInCity,
    beauticiansInCity,
    appointments,
    totalPaidPayments,
    services,
    beauticianUsers,
    lastLocations,
    inProgressByBeautician,
    revenueRow,
    delayedAppointments,
    pendingPayments,
    bCount,
    vendorName
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.CUSTOMER, city: cityId }),
    User.countDocuments({ role: ROLES.BEAUTICIAN, city: cityId }),
    Appointment.countDocuments(scopeMatch),
    Payment.countDocuments({
      status: 'paid',
      $or: [{ appointment: { $in: scopedApptIds } }, { paymentType: 'wallet_recharge', customer: { $in: cityUserIds } }]
    }),
    Service.countDocuments(),
    User.find({ role: ROLES.BEAUTICIAN, city: cityId })
      .select('name city')
      .populate('city')
      .lean(),
    beauticianIdsInCity.length
      ? LocationTracking.aggregate([
          { $match: { beautician: { $in: beauticianIdsInCity } } },
          { $sort: { recordedAt: -1 } },
          { $group: { _id: '$beautician', location: { $first: '$location' }, recordedAt: { $first: '$recordedAt' } } }
        ])
      : Promise.resolve([]),
    beauticianIdsInCity.length
      ? Appointment.find({
          status: APPOINTMENT_STATUS.IN_PROGRESS,
          beautician: { $in: beauticianIdsInCity }
        })
          .select('beautician')
          .lean()
      : Promise.resolve([]),
    Payment.aggregate([
      { $match: { status: 'paid' } },
      { $lookup: { from: 'appointments', localField: 'appointment', foreignField: '_id', as: 'app' } },
      { $unwind: '$app' },
      { $match: { 'app.vendor': vendorId } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Appointment.find({
      status: APPOINTMENT_STATUS.IN_PROGRESS,
      startedAt: { $exists: true, $ne: null },
      beautician: { $in: beauticianIdsInCity },
      $expr: { $gt: [{ $subtract: [new Date(), '$startedAt'] }, 45 * 60 * 1000] }
    })
      .populate({ path: 'beautician', populate: { path: 'city' } })
      .lean(),
    Payment.find({
      status: 'pending',
      $or: [{ appointment: { $in: scopedApptIds } }, { paymentType: 'wallet_recharge', customer: { $in: cityUserIds } }]
    }).countDocuments(),
    BeauticianProfile.countDocuments({ vendor: vendorId }),
    Vendor.findById(vendorId).select('name').lean()
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
      description: `${pendingPayments} settlements pending in your scope`,
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

  const rev = revenueRow && revenueRow[0] && revenueRow[0].total ? revenueRow[0].total : 0;
  const name = vendorName?.name || 'Vendor';
  const topVendors = [
    {
      id: vendorId.toString(),
      name,
      city: '',
      revenue: rev,
      beauticians: bCount || 0,
      growth: 0,
      avatar: name.substring(0, 2).toUpperCase()
    }
  ];

  return {
    totalCities: 1,
    totalVendors: 1,
    totalServices: services,
    totalAppointments: appointments,
    totalPaidPayments,
    liveBeauticians,
    recentAlerts,
    topVendors,
    scope: { customersInCity, beauticiansInCity }
  };
}

const getDashboard = async (vendorScope) => {
  if (vendorScope) {
    return getDashboardVendorScoped(vendorScope);
  }
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

const getAlerts = async (vendorScope) => {
  const delayedFilter = {
    status: APPOINTMENT_STATUS.IN_PROGRESS,
    startedAt: { $exists: true, $ne: null }
  };
  if (vendorScope) {
    const bids = await User.find({ role: ROLES.BEAUTICIAN, city: vendorScope.cityId }).select('_id').lean();
    delayedFilter.beautician = { $in: bids.map((b) => b._id) };
  }

  const pendingPayFilter = { status: 'pending' };
  if (vendorScope) {
    const scopeMatch = await buildVendorAppointmentMatch(vendorScope);
    const scopedApptIds = (await Appointment.find(scopeMatch).select('_id').lean()).map((a) => a._id);
    const cityUserIds = (await User.find({ city: vendorScope.cityId }).select('_id').lean()).map((u) => u._id);
    pendingPayFilter.$or = [{ appointment: { $in: scopedApptIds } }, { paymentType: 'wallet_recharge', customer: { $in: cityUserIds } }];
  }

  const [delayed, pendingPayments] = await Promise.all([
    Appointment.find(delayedFilter).populate('beautician').lean(),
    Payment.find(pendingPayFilter).lean()
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

const getReports = async (query, vendorScope) => {
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

  const qVendorId = query.vendorId;
  const qBeauticianId = query.beauticianId;
  const appointmentFilter = {};
  if (qVendorId && qBeauticianId) {
    appointmentFilter.vendor = qVendorId;
    appointmentFilter.beautician = qBeauticianId;
  } else if (qVendorId) {
    const vendorBeauticianUserIds = await BeauticianProfile.find({ vendor: qVendorId }).distinct('user');
    appointmentFilter.$or = [{ vendor: qVendorId }, { beautician: { $in: vendorBeauticianUserIds } }];
  } else if (qBeauticianId) {
    appointmentFilter.beautician = qBeauticianId;
  }

  if (Object.keys(appointmentFilter).length > 0) {
    let apptIds = (await Appointment.find(appointmentFilter).select('_id').lean()).map((a) => a._id);

    if (vendorScope) {
      if (qVendorId && String(qVendorId) !== String(vendorScope.vendorId)) {
        throw new ApiError(403, 'Forbidden');
      }
      if (qBeauticianId) {
        const bu = await User.findById(qBeauticianId).select('city role').lean();
        if (!bu || bu.role !== ROLES.BEAUTICIAN) throw new ApiError(404, 'Beautician not found');
        if (String(bu.city) !== String(vendorScope.cityId)) throw new ApiError(403, 'Forbidden');
      }
      const scopeMatch = await buildVendorAppointmentMatch(vendorScope);
      const scopedIds = (await Appointment.find(scopeMatch).select('_id').lean()).map((a) => a._id);
      const scopedSet = new Set(scopedIds.map((id) => String(id)));
      apptIds = apptIds.filter((id) => scopedSet.has(String(id)));
    } else if (qBeauticianId) {
      const bu = await User.findById(qBeauticianId).select('role').lean();
      if (!bu || bu.role !== ROLES.BEAUTICIAN) throw new ApiError(404, 'Beautician not found');
    }

    if (apptIds.length === 0) {
      return { payments: [] };
    }
    match.appointment = { $in: apptIds };
  } else if (vendorScope) {
    const scopeMatch = await buildVendorAppointmentMatch(vendorScope);
    const scopedApptIds = (await Appointment.find(scopeMatch).select('_id').lean()).map((a) => a._id);
    const cityUserIds = (await User.find({ city: vendorScope.cityId }).select('_id').lean()).map((u) => u._id);
    match.$or = [{ appointment: { $in: scopedApptIds } }, { paymentType: 'wallet_recharge', customer: { $in: cityUserIds } }];
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

const getBeauticianLiveLocation = async (userId, vendorScope) => {
  const user = await User.findOne({ _id: userId, role: ROLES.BEAUTICIAN }).populate('city').lean();
  if (!user) throw new ApiError(404, 'Beautician not found');
  if (vendorScope) {
    if (!user.city || String(user.city._id || user.city) !== String(vendorScope.cityId)) {
      throw new ApiError(403, 'Forbidden');
    }
  }

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

const getPayments = async (query, vendorScope) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;

  if (vendorScope) {
    const scopeMatch = await buildVendorAppointmentMatch(vendorScope);
    const scopedAppts = await Appointment.find(scopeMatch).select('_id').lean();
    const apptIds = scopedAppts.map((a) => a._id);
    const cityUsers = await User.find({ city: vendorScope.cityId }).select('_id').lean();
    const uidList = cityUsers.map((u) => u._id);
    filter.$or = [
      { appointment: { $in: apptIds } },
      { paymentType: 'wallet_recharge', customer: { $in: uidList } }
    ];
  }

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
    paymentType: p.paymentType || 'appointment',
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
const getAppointments = async (query, vendorScope) => {
  const { page, limit, skip } = getPagination(query);
  const base = {};
  if (query.status) base.status = query.status;
  if (query.customerId) base.customer = query.customerId;
  if (query.vendorId && query.beauticianId) {
    base.vendor = query.vendorId;
    base.beautician = query.beauticianId;
  } else if (query.vendorId) {
    const vendorBeauticianUserIds = await BeauticianProfile.find({ vendor: query.vendorId }).distinct('user');
    base.$or = [{ vendor: query.vendorId }, { beautician: { $in: vendorBeauticianUserIds } }];
  } else if (query.beauticianId) {
    base.beautician = query.beauticianId;
  }

  let filter = base;
  if (vendorScope) {
    const scopeMatch = await buildVendorAppointmentMatch(vendorScope);
    filter = Object.keys(base).length ? { $and: [base, scopeMatch] } : scopeMatch;
  }

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

const getAppointmentById = async (id, vendorScope) => {
  const appointment = await Appointment.findById(id)
    .populate('customer beautician service')
    .lean();
  if (!appointment) throw new ApiError(404, 'Appointment not found');

  if (vendorScope) {
    const scopeMatch = await buildVendorAppointmentMatch(vendorScope);
    const test = await Appointment.findOne({ _id: id, ...scopeMatch }).select('_id').lean();
    if (!test) throw new ApiError(403, 'Forbidden');
  }

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

const updateAppointment = async (id, payload, vendorScope) => {
  if (vendorScope) {
    throw new ApiError(403, 'Forbidden');
  }
  const appointment = await Appointment.findById(id);
  if (!appointment) throw new ApiError(404, 'Appointment not found');

  const previousBeauticianId = appointment.beautician ? appointment.beautician.toString() : null;

  if (payload.beautician !== undefined) {
    appointment.beautician = payload.beautician || null;
    if (appointment.beautician) {
      const bp = await BeauticianProfile.findOne({ user: appointment.beautician }).select('vendor').lean();
      appointment.vendor = bp?.vendor || null;
    } else {
      appointment.vendor = null;
    }

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

  return getAppointmentById(id, null);
};

// Inventory (admin / vendor panel — stock also powers customer shop in same city)
const getAdminInventory = async (query, vendorScope) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (vendorScope) {
    filter.vendor = vendorScope.vendorId;
  } else if (query.vendorId) {
    filter.vendor = query.vendorId;
  }
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }
  const [items, total] = await Promise.all([
    Inventory.find(filter).populate('vendor', 'name email').skip(skip).limit(limit).sort({ createdAt: -1 }),
    Inventory.countDocuments(filter)
  ]);
  return { items, meta: getMeta({ page, limit, total }) };
};

const createAdminInventoryItem = async (payload, vendorScope) => {
  const vendorId = vendorScope ? vendorScope.vendorId : payload.vendorId;
  if (!vendorId) {
    throw new ApiError(400, 'vendorId is required');
  }
  if (vendorScope && String(vendorId) !== String(vendorScope.vendorId)) {
    throw new ApiError(403, 'Forbidden');
  }
  const name = String(payload.name || '').trim();
  if (!name) throw new ApiError(400, 'Name is required');
  return Inventory.create({
    vendor: vendorId,
    name,
    sku: payload.sku != null ? String(payload.sku).trim() : '',
    quantity: payload.quantity != null ? Number(payload.quantity) : 0,
    unit: payload.unit != null ? String(payload.unit).trim() : '',
    costPrice: payload.costPrice != null ? Number(payload.costPrice) : undefined,
    sellingPrice: payload.sellingPrice != null ? Number(payload.sellingPrice) : undefined,
    isActive: payload.isActive !== false,
    showInShop: payload.showInShop !== false,
    imageUrl: payload.imageUrl != null ? String(payload.imageUrl).trim() : '',
    description: payload.description != null ? String(payload.description).trim() : ''
  });
};

const updateAdminInventoryItem = async (id, payload, vendorScope) => {
  const item = await Inventory.findById(id);
  if (!item) throw new ApiError(404, 'Inventory item not found');
  if (vendorScope && String(item.vendor) !== String(vendorScope.vendorId)) {
    throw new ApiError(403, 'Forbidden');
  }
  const keys = [
    'name',
    'sku',
    'quantity',
    'unit',
    'costPrice',
    'sellingPrice',
    'isActive',
    'showInShop',
    'imageUrl',
    'description'
  ];
  keys.forEach((k) => {
    if (payload[k] === undefined) return;
    if (k === 'quantity' || k === 'costPrice' || k === 'sellingPrice') {
      item[k] = payload[k] != null ? Number(payload[k]) : item[k];
    } else if (k === 'isActive' || k === 'showInShop') {
      item[k] = Boolean(payload[k]);
    } else {
      item[k] = payload[k];
    }
  });
  await item.save();
  return item;
};

const deleteAdminInventoryItem = async (id, vendorScope) => {
  const item = await Inventory.findById(id);
  if (!item) throw new ApiError(404, 'Inventory item not found');
  if (vendorScope && String(item.vendor) !== String(vendorScope.vendorId)) {
    throw new ApiError(403, 'Forbidden');
  }
  await Inventory.deleteOne({ _id: id });
  return true;
};

const getAdminProductOrders = async (query, vendorScope) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (vendorScope) {
    filter.vendor = vendorScope.vendorId;
  } else if (query.vendorId) {
    filter.vendor = query.vendorId;
  }
  if (query.status) {
    filter.status = query.status;
  }
  const [items, total] = await Promise.all([
    ProductOrder.find(filter)
      .populate('customer', 'name email phone')
      .populate('vendor', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    ProductOrder.countDocuments(filter)
  ]);
  return { items, meta: getMeta({ page, limit, total }) };
};

const updateAdminProductOrderStatus = async (id, status, vendorScope) => {
  const order = await ProductOrder.findById(id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (vendorScope && String(order.vendor) !== String(vendorScope.vendorId)) {
    throw new ApiError(403, 'Forbidden');
  }
  const allowed = [
    PRODUCT_ORDER_STATUS.CONFIRMED,
    PRODUCT_ORDER_STATUS.PROCESSING,
    PRODUCT_ORDER_STATUS.SHIPPED,
    PRODUCT_ORDER_STATUS.DELIVERED,
    PRODUCT_ORDER_STATUS.CANCELLED
  ];
  if (!allowed.includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }
  order.status = status;
  await order.save();
  return order;
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
  updateAppointment,
  getAdminInventory,
  createAdminInventoryItem,
  updateAdminInventoryItem,
  deleteAdminInventoryItem,
  getAdminProductOrders,
  updateAdminProductOrderStatus
};

