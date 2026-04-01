const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24);

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

const verifyServiceOtp = {
  params: Joi.object({
    id: objectId().required()
  }),
  body: Joi.object({
    otp: Joi.string().length(6).pattern(/^\d+$/).required()
  })
};

const rateCustomer = {
  params: Joi.object({
    id: objectId().required()
  }),
  body: Joi.object({
    stars: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().max(500).allow('', null).optional()
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

// Availability
const availability = {
  body: Joi.object({
    isAvailable: Joi.boolean().required()
  })
};

// KYC submit
const submitKyc = {
  body: Joi.object({
    documents: Joi.array()
      .items(
        Joi.object({
          type: Joi.string().valid('aadhar', 'pan', 'license', 'photo', 'selfie', 'experience', 'other').required(),
          url: Joi.string().uri().required()
        })
      )
      .min(1)
      .required()
  })
};

module.exports = {
  getAppointments,
  appointmentIdParam,
  verifyServiceOtp,
  rateCustomer,
  updateLocation,
  locationHistory,
  productUsage,
  availability,
  submitKyc
};

