const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24);

// Services
const getServices = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional().empty('')
  })
};

// Booking
const createAppointment = {
  body: Joi.object({
    serviceId: objectId().required(),
    scheduledAt: Joi.date().iso().required(),
    address: Joi.string().min(5).max(500).required(),
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    price: Joi.number().positive().required()
  })
};

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

const cancelAppointment = appointmentIdParam;

// Tracking
const trackAppointment = {
  params: Joi.object({
    appointmentId: objectId().required()
  })
};

// Payments
const initiatePayment = {
  body: Joi.object({
    appointmentId: objectId().required()
  })
};

const verifyPayment = {
  body: Joi.object({
    paymentId: objectId().required(),
    providerPaymentId: Joi.string().required(),
    providerSignature: Joi.string().required()
  })
};

const getInvoices = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  })
};

module.exports = {
  getServices,
  createAppointment,
  getAppointments,
  appointmentIdParam,
  cancelAppointment,
  trackAppointment,
  initiatePayment,
  verifyPayment,
  getInvoices
};

