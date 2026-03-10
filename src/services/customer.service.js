const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const LocationTracking = require('../models/LocationTracking');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { ROLES, APPOINTMENT_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const { getPagination, getMeta } = require('../utils/pagination');
const { buildPoint, getEtaBetweenPoints } = require('../utils/location');
const notificationService = require('./notification.service');

// Services listing for customers
const getServices = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { isActive: true };
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }

  const [items, total] = await Promise.all([
    Service.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Service.countDocuments(filter)
  ]);

  return { items, meta: getMeta({ page, limit, total }) };
};

// Booking
const createAppointment = async (customerId, payload) => {
  const { serviceId, scheduledAt, address, lat, lng, price } = payload;

  const service = await Service.findById(serviceId);
  if (!service) throw new ApiError(404, 'Service not found');

  const appointment = await Appointment.create({
    customer: customerId,
    service: serviceId,
    scheduledAt,
    address,
    location: buildPoint(lat, lng),
    price
  });

  // Notify beauticians about new booking (broadcast to all active beauticians with FCM)
  try {
    const beauticians = await User.find({ role: ROLES.BEAUTICIAN, isActive: true }).select('_id').lean();
    await Promise.allSettled(
      beauticians.map((b) =>
        notificationService.sendFCM(b._id, {
          title: 'New booking request',
          body: `${service.name} booking created. Open app to view details.`,
          data: {
            type: 'appointment_created',
            appointmentId: String(appointment._id)
          }
        })
      )
    );
  } catch {
    // notification failures should not block booking
  }

  return appointment;
};

const getAppointments = async (customerId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { customer: customerId };
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .populate('service beautician')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Appointment.countDocuments(filter)
  ]);

  return { items, meta: getMeta({ page, limit, total }) };
};

const getAppointmentById = async (customerId, id) => {
  const appt = await Appointment.findById(id).populate('service beautician');
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (String(appt.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden: appointment does not belong to customer');
  }
  return appt;
};

const cancelAppointment = async (customerId, id) => {
  const appt = await Appointment.findById(id);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (String(appt.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden: appointment does not belong to customer');
  }
  if (![APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.ACCEPTED].includes(appt.status)) {
    throw new ApiError(400, 'Only pending or accepted appointments can be cancelled');
  }
  appt.status = APPOINTMENT_STATUS.CANCELLED;
  await appt.save();
  return appt;
};

// Tracking: latest beautician location + ETA placeholder
const trackAppointment = async (customerId, appointmentId) => {
  const appt = await Appointment.findById(appointmentId).populate('beautician');
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (String(appt.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden: appointment does not belong to customer');
  }

  if (![APPOINTMENT_STATUS.ACCEPTED, APPOINTMENT_STATUS.IN_PROGRESS].includes(appt.status)) {
    throw new ApiError(400, 'Tracking is allowed only for active appointments');
  }

  const latestLocation = await LocationTracking.findOne({
    beautician: appt.beautician,
    appointment: appt.id
  }).sort({ recordedAt: -1 });

  if (!latestLocation) {
    throw new ApiError(404, 'No location data available yet');
  }

  const [lng, lat] = appt.location.coordinates;
  const [bLng, bLat] = latestLocation.location.coordinates;

  const eta = await getEtaBetweenPoints({
    origin: { lat: bLat, lng: bLng },
    destination: { lat, lng }
  });

  return {
    beauticianLocation: latestLocation.location,
    eta
  };
};

// Payments (mock Razorpay integration)
const initiatePayment = async (customerId, { appointmentId }) => {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (String(appt.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden: appointment does not belong to customer');
  }

  // In production, call Razorpay to create an order.
  const orderId = `order_mock_${Date.now()}`;

  const payment = await Payment.create({
    appointment: appt.id,
    customer: customerId,
    amount: appt.price,
    providerOrderId: orderId
  });

  return {
    paymentId: payment.id,
    orderId,
    amount: appt.price,
    currency: 'INR'
  };
};

const verifyPayment = async (customerId, { paymentId, providerPaymentId, providerSignature }) => {
  const payment = await Payment.findById(paymentId).populate('appointment');
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (String(payment.customer) !== String(customerId)) {
    throw new ApiError(403, 'Forbidden: payment does not belong to customer');
  }

  // In production, verify Razorpay signature.
  payment.providerPaymentId = providerPaymentId;
  payment.providerSignature = providerSignature;
  payment.status = PAYMENT_STATUS.PAID;
  await payment.save();

  return payment;
};

const getInvoices = async (customerId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { customer: customerId, status: PAYMENT_STATUS.PAID };

  const [items, total] = await Promise.all([
    Payment.find(filter).populate('appointment').skip(skip).limit(limit).sort({ createdAt: -1 }),
    Payment.countDocuments(filter)
  ]);

  return { items, meta: getMeta({ page, limit, total }) };
};

module.exports = {
  getServices,
  createAppointment,
  getAppointments,
  getAppointmentById,
  cancelAppointment,
  trackAppointment,
  initiatePayment,
  verifyPayment,
  getInvoices
};

