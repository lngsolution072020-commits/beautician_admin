const BeauticianProfile = require('../models/BeauticianProfile');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Inventory = require('../models/Inventory');
const Payment = require('../models/Payment');
const Vendor = require('../models/Vendor');
const ApiError = require('../utils/apiError');
const { ROLES } = require('../utils/constants');
const { getPagination, getMeta } = require('../utils/pagination');

// Ensure the vendor in context is allowed
const assertVendorAccess = (resourceVendorId, currentVendorId) => {
  if (!resourceVendorId || resourceVendorId.toString() !== String(currentVendorId)) {
    throw new ApiError(403, 'Forbidden: vendor mismatch');
  }
};

// Beauticians
const createBeautician = async (currentVendorId, payload) => {
  const { name, email, password, phone, expertise, experienceYears, salaryType } = payload;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(400, 'Email already in use');
  }

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: ROLES.BEAUTICIAN,
    vendor: currentVendorId
  });

  const beauticianProfile = await BeauticianProfile.create({
    user: user.id,
    vendor: currentVendorId,
    expertise,
    experienceYears,
    salaryType
  });

  user.beauticianProfile = beauticianProfile.id;
  await user.save();

  return { user, beauticianProfile };
};

const getCityUsers = async (currentVendorId, query) => {
  const { page, limit, skip } = getPagination(query);
  const vendor = await Vendor.findById(currentVendorId).lean();
  if (!vendor) throw new ApiError(404, 'Vendor not found');

  const filter = { city: vendor.city, role: ROLES.CUSTOMER };

  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
      { phone: { $regex: query.search, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter).select('-password').skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(filter)
  ]);

  return { items, meta: getMeta({ page, limit, total }) };
};

const getBeauticians = async (currentVendorId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { vendor: currentVendorId };

  if (query.search) {
    filter.$or = [
      { 'user.name': { $regex: query.search, $options: 'i' } }
    ];
  }

  const aggregate = BeauticianProfile.aggregate([
    { $match: { vendor: currentVendorId } },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    { $skip: skip },
    { $limit: limit },
    { $sort: { createdAt: -1 } }
  ]);

  const [items, total] = await Promise.all([
    aggregate,
    BeauticianProfile.countDocuments({ vendor: currentVendorId })
  ]);

  return { items, meta: getMeta({ page, limit, total }) };
};

const updateBeautician = async (currentVendorId, id, payload) => {
  const profile = await BeauticianProfile.findById(id);
  if (!profile) throw new ApiError(404, 'Beautician not found');
  assertVendorAccess(profile.vendor, currentVendorId);

  Object.assign(profile, payload);
  await profile.save();

  return profile;
};

const deleteBeautician = async (currentVendorId, id) => {
  const profile = await BeauticianProfile.findById(id);
  if (!profile) throw new ApiError(404, 'Beautician not found');
  assertVendorAccess(profile.vendor, currentVendorId);

  await BeauticianProfile.deleteOne({ _id: id });
  return true;
};

// Appointments
const getAppointments = async (currentVendorId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { vendor: currentVendorId };
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .populate('customer beautician service')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Appointment.countDocuments(filter)
  ]);

  return { items, meta: getMeta({ page, limit, total }) };
};

const getAppointmentById = async (currentVendorId, id) => {
  const appt = await Appointment.findById(id).populate('customer beautician service');
  if (!appt) throw new ApiError(404, 'Appointment not found');
  assertVendorAccess(appt.vendor, currentVendorId);
  return appt;
};

const assignBeautician = async (currentVendorId, appointmentId, beauticianUserId) => {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  assertVendorAccess(appt.vendor, currentVendorId);

  if (appt.status !== 'pending') {
    throw new ApiError(400, 'Only pending appointments can be assigned');
  }

  const beautician = await User.findOne({ _id: beauticianUserId, role: ROLES.BEAUTICIAN });
  if (!beautician) throw new ApiError(404, 'Beautician not found');

  // Verify beautician belongs to this vendor
  const profile = await BeauticianProfile.findOne({ user: beauticianUserId });
  if (!profile) throw new ApiError(404, 'Beautician profile not found');
  assertVendorAccess(profile.vendor, currentVendorId);

  appt.beautician = beauticianUserId;
  appt.status = 'accepted'; // Directly accept if vendor assigns? Or keep pending? 
  // User said "vendor uske end se beautician select kr de" - usually this means it's assigned and ready.
  // In the current flow, 'accepted' means a beautician has it.
  
  await appt.save();

  // Trigger notification to beautician
  const notificationService = require('./notification.service');
  await notificationService.sendNotification(beauticianUserId, {
    title: 'New Assignment',
    body: `You have been assigned to a new booking at ${appt.address}`,
    data: {
      type: 'appointment_assigned',
      appointmentId: appt._id.toString()
    }
  });

  return appt;
};

// Inventory
const createInventoryItem = async (currentVendorId, payload) =>
  Inventory.create({ ...payload, vendor: currentVendorId });

const getInventory = async (currentVendorId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { vendor: currentVendorId };
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }

  const [items, total] = await Promise.all([
    Inventory.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Inventory.countDocuments(filter)
  ]);

  return { items, meta: getMeta({ page, limit, total }) };
};

const updateInventoryItem = async (currentVendorId, id, payload) => {
  const item = await Inventory.findById(id);
  if (!item) throw new ApiError(404, 'Inventory item not found');
  assertVendorAccess(item.vendor, currentVendorId);

  Object.assign(item, payload);
  await item.save();
  return item;
};

const deleteInventoryItem = async (currentVendorId, id) => {
  const item = await Inventory.findById(id);
  if (!item) throw new ApiError(404, 'Inventory item not found');
  assertVendorAccess(item.vendor, currentVendorId);

  await Inventory.deleteOne({ _id: id });
  return true;
};

// Earnings and reports
const getEarnings = async (currentVendorId, query) => {
  const match = { vendor: currentVendorId, status: 'paid' };
  if (query.from || query.to) {
    match.createdAt = {};
    if (query.from) match.createdAt.$gte = new Date(query.from);
    if (query.to) match.createdAt.$lte = new Date(query.to);
  }

  const [summary] = await Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return summary || { totalAmount: 0, count: 0 };
};

const getReports = async (currentVendorId, query) => {
  const match = { vendor: currentVendorId };
  if (query.status) match.status = query.status;

  const appointments = await Appointment.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  return { appointments };
};

module.exports = {
  createBeautician,
  getBeauticians,
  getCityUsers,
  updateBeautician,
  deleteBeautician,
  getAppointments,
  getAppointmentById,
  assignBeautician,
  createInventoryItem,
  getInventory,
  updateInventoryItem,
  deleteInventoryItem,
  getEarnings,
  getReports
};

