const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24);

// Beauticians
const createBeautician = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(50).required(),
    phone: Joi.string().optional(),
    expertise: Joi.array().items(Joi.string()).optional(),
    experienceYears: Joi.number().integer().min(0).optional()
  })
};

const getBeauticians = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional().empty('')
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
    expertise: Joi.array().items(Joi.string()).optional(),
    experienceYears: Joi.number().integer().min(0).optional(),
    isAvailable: Joi.boolean().optional()
  })
};

// Appointments
const getAppointments = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().optional().empty('')
  })
};

const appointmentIdParam = {
  params: Joi.object({
    id: objectId().required()
  })
};

// Inventory
const createInventory = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    sku: Joi.string().optional(),
    quantity: Joi.number().integer().min(0).optional(),
    unit: Joi.string().optional(),
    costPrice: Joi.number().min(0).optional(),
    sellingPrice: Joi.number().min(0).optional(),
    isActive: Joi.boolean().optional()
  })
};

const getInventory = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional().empty('')
  })
};

const inventoryIdParam = {
  params: Joi.object({
    id: objectId().required()
  })
};

const updateInventory = {
  ...inventoryIdParam,
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    sku: Joi.string().optional(),
    quantity: Joi.number().integer().min(0).optional(),
    unit: Joi.string().optional(),
    costPrice: Joi.number().min(0).optional(),
    sellingPrice: Joi.number().min(0).optional(),
    isActive: Joi.boolean().optional()
  })
};

// Earnings & reports
const earningsQuery = {
  query: Joi.object({
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional()
  })
};

const reportsQuery = {
  query: Joi.object({
    status: Joi.string().optional().empty('')
  })
};

module.exports = {
  createBeautician,
  getBeauticians,
  beauticianIdParam,
  updateBeautician,
  getAppointments,
  appointmentIdParam,
  createInventory,
  getInventory,
  inventoryIdParam,
  updateInventory,
  earningsQuery,
  reportsQuery
};

