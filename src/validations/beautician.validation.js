const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24);

// Appointments
const getAppointments = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().allow('').optional()
  })
};

const appointmentIdParam = {
  params: Joi.object({
    id: objectId().required()
  })
};

// Location
const updateLocation = {
  body: Joi.object({
    appointmentId: objectId().required(),
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
  })
};

const locationHistory = {
  query: Joi.object({
    appointmentId: objectId().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  })
};

// Product usage
const productUsage = {
  body: Joi.object({
    inventoryItemId: objectId().required(),
    quantityUsed: Joi.number().positive().required()
  })
};

module.exports = {
  getAppointments,
  appointmentIdParam,
  updateLocation,
  locationHistory,
  productUsage
};

