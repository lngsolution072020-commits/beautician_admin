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

const getServicesByCategory = {
  params: Joi.object({
    categoryId: objectId().required()
  }),
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

const beauticianUserIdParam = {
  params: Joi.object({
    id: objectId().required()
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
    price: Joi.number().positive().required(),
    paymentMode: Joi.string().valid('online', 'cod', 'wallet').optional(),
    /** Optional: assign + notify this beautician (User id) when customer chose a specific expert */
    beauticianUserId: objectId().optional().empty('')
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

// Shop / product orders
const getShopProducts = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional().allow('')
  })
};

const createProductOrder = {
  body: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          inventoryItemId: objectId().required(),
          quantity: Joi.number().integer().min(1).max(999).required()
        })
      )
      .min(1)
      .required(),
    address: Joi.string().min(5).max(500).required(),
    lat: Joi.number().min(-90).max(90).optional(),
    lng: Joi.number().min(-180).max(180).optional(),
    paymentMode: Joi.string().valid('online', 'cod', 'wallet').optional()
  })
};

const productOrderIdParam = {
  params: Joi.object({
    id: objectId().required()
  })
};

const getProductOrders = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  })
};

// Payments
const initiatePayment = {
  body: Joi.object({
    appointmentId: objectId().optional(),
    productOrderId: objectId().optional()
  }).or('appointmentId', 'productOrderId')
};

const verifyPayment = {
  body: Joi.object({
    paymentId: objectId().required(),
    providerPaymentId: Joi.string().required(),
    providerSignature: Joi.string().required()
  })
};

const initiateWalletRecharge = {
  body: Joi.object({
    amount: Joi.number().min(1).max(500000).required()
  })
};

const getInvoices = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  })
};

const rateAppointment = {
  params: Joi.object({
    id: objectId().required()
  }),
  body: Joi.object({
    stars: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().max(500).allow('', null).optional()
  })
};

module.exports = {
  getServices,
  getServicesByCategory,
  serviceIdParam,
  beauticianUserIdParam,
  createAppointment,
  getAppointments,
  appointmentIdParam,
  cancelAppointment,
  trackAppointment,
  getShopProducts,
  createProductOrder,
  productOrderIdParam,
  getProductOrders,
  initiatePayment,
  initiateWalletRecharge,
  verifyPayment,
  getInvoices,
  rateAppointment
};

