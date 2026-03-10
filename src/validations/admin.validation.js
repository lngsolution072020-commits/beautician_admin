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

// Services
const createService = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    category: Joi.string().optional(),
    imageUrl: Joi.string().uri().optional(),
    description: Joi.string().optional(),
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
    category: Joi.string().optional(),
    imageUrl: Joi.string().uri().optional(),
    description: Joi.string().optional(),
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

// Dashboard & Reports
const getDashboard = {};

const getReports = {
  query: Joi.object({
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional()
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
  createService,
  getServices,
  serviceIdParam,
  updateService,
  getBeauticians,
  createBeautician,
  getDashboard,
  getReports
};

