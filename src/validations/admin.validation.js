const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24);

// Cities
const createCity = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    state: Joi.string().optional(),
    country: Joi.string().optional(),
    isActive: Joi.boolean().optional()
  })
};

const updateCity = {
  params: Joi.object({
    id: objectId().required()
  }),
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    state: Joi.string().optional(),
    country: Joi.string().optional(),
    isActive: Joi.boolean().optional()
  })
};

const getCities = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional().empty('')
  })
};

// Vendors
const createVendor = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().optional(),
    city: objectId().required(),
    address: Joi.string().optional(),
    isActive: Joi.boolean().optional()
  })
};

const getVendors = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional().empty(''),
    cityId: Joi.alternatives().try(objectId(), Joi.string().valid('')).optional().custom((v) => (v === '' ? undefined : v))
  })
};

const vendorIdParam = {
  params: Joi.object({
    id: objectId().required()
  })
};

const updateVendor = {
  ...vendorIdParam,
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
    isActive: Joi.boolean().optional()
  })
};

// Banners
const createBanner = {
  body: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    imageUrl: Joi.string().optional(),
    link: Joi.string().max(500).optional().allow(''),
    order: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional()
  })
};

const getBanners = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  })
};

const bannerIdParam = {
  params: Joi.object({
    id: objectId().required()
  })
};

const updateBanner = {
  ...bannerIdParam,
  body: Joi.object({
    title: Joi.string().min(1).max(200).optional(),
    imageUrl: Joi.string().uri().optional(),
    link: Joi.string().max(500).optional().allow(''),
    order: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional()
  })
};

// Categories
const createCategory = {
  body: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    imageUrl: Joi.string().uri().optional(),
    order: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional()
  })
};

const getCategories = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional().empty('')
  })
};

const categoryIdParam = {
  params: Joi.object({
    id: objectId().required()
  })
};

const updateCategory = {
  ...categoryIdParam,
  body: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    imageUrl: Joi.string().uri().optional(),
    order: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional()
  })
};

// Services
const createService = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    category: Joi.alternatives().try(Joi.string(), objectId()).optional(),
    imageUrl: Joi.string().uri().optional(),
    description: Joi.string().optional(),
    includes: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().min(1).max(200)),
        Joi.string() // FormData JSON string
      )
      .optional(),
    experts: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().min(1).max(200)),
        Joi.string()
      )
      .optional(),
    basePrice: Joi.number().positive().required(),
    durationMinutes: Joi.number().integer().min(5).required(),
    isActive: Joi.boolean().optional()
  })
};

const getServices = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional().empty('')
  })
};

const serviceIdParam = {
  params: Joi.object({
    id: objectId().required()
  })
};

const updateService = {
  ...serviceIdParam,
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    category: Joi.alternatives().try(Joi.string(), objectId()).optional(),
    imageUrl: Joi.string().uri().optional(),
    description: Joi.string().optional(),
    includes: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().min(1).max(200)),
        Joi.string()
      )
      .optional(),
    experts: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().min(1).max(200)),
        Joi.string()
      )
      .optional(),
    basePrice: Joi.number().positive().optional(),
    durationMinutes: Joi.number().integer().min(5).optional(),
    isActive: Joi.boolean().optional()
  })
};

// Beauticians
const getBeauticians = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional().empty(''),
    cityId: Joi.alternatives().try(objectId(), Joi.string().valid('')).optional().custom((v) => (v === '' ? undefined : v))
  })
};

const createBeautician = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).optional(),
    phone: Joi.string().optional(),
    vendorId: objectId().required(),
    cityId: objectId().optional()
  })
};

const beauticianIdParam = {
  params: Joi.object({
    id: objectId().required()
  })
};

const updateBeautician = {
  ...beauticianIdParam,
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    phone: Joi.string().optional(),
    password: Joi.string().min(6).optional(),
    rating: Joi.number().min(0).max(5).optional(),
    walletBalance: Joi.number().min(0).optional(),
    isActive: Joi.boolean().optional(),
    expertise: Joi.array().items(Joi.string()).optional(),
    experienceYears: Joi.number().min(0).optional(),
    isAvailable: Joi.boolean().optional(),
    kycStatus: Joi.string().valid('pending', 'approved', 'rejected').optional(),
    documents: Joi.array()
      .items(
        Joi.object({
          id: objectId().required(),
          status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
          notes: Joi.string().allow('').optional()
        })
      )
      .optional()
  })
};

// Users
const getUsers = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional().empty(''),
    role: Joi.string().valid('customer', 'beautician').optional()
  })
};

const userIdParam = {
  params: Joi.object({
    id: objectId().required()
  })
};

const updateUser = {
  ...userIdParam,
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    phone: Joi.string().optional(),
    password: Joi.string().min(6).optional(),
    isActive: Joi.boolean().optional()
  })
};

// Dashboard & Reports
const getDashboard = {};

const getReports = {
  query: Joi.object({
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional()
  })
};

// Appointments / Orders
const getAppointments = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().optional().empty(''),
    customerId: objectId().optional(),
    beauticianId: objectId().optional()
  })
};

const appointmentIdParam = {
  params: Joi.object({
    id: objectId().required()
  })
};

const updateAppointment = {
  params: Joi.object({
    id: objectId().required()
  }),
  body: Joi.object({
    beautician: Joi.alternatives().try(objectId(), Joi.valid(null)).optional()
  })
};

module.exports = {
  createCity,
  updateCity,
  getCities,
  createVendor,
  getVendors,
  vendorIdParam,
  updateVendor,
  createBanner,
  getBanners,
  bannerIdParam,
  updateBanner,
  createCategory,
  getCategories,
  categoryIdParam,
  updateCategory,
  createService,
  getServices,
  serviceIdParam,
  updateService,
  getBeauticians,
  beauticianIdParam,
  updateBeautician,
  createBeautician,
  getUsers,
  userIdParam,
  updateUser,
  getDashboard,
  getReports,
  getAppointments,
  appointmentIdParam,
  updateAppointment
};

