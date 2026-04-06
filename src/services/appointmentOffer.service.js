const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const Payment = require('../models/Payment');
const CustomerProfile = require('../models/CustomerProfile');
const logger = require('../config/logger');
const { APPOINTMENT_STATUS } = require('../utils/constants');
const notificationService = require('./notification.service');
const { pickBeauticianForBooking } = require('./beauticianMatching.service');

const OFFER_MS = 30_000;

async function notifyOfferFCM(appt, serviceName) {
  if (!appt?.beautician) return false;
  try {
    const sent = await notificationService.sendFCM(appt.beautician, {
      title: 'New booking request',
      body: `${serviceName} — accept within 30 seconds or it passes to the next expert.`,
      data: {
        type: 'appointment_created',
        appointmentId: String(appt._id),
        offerExpiresAt: appt.offerExpiresAt ? new Date(appt.offerExpiresAt).toISOString() : ''
      }
    });
    if (!sent) {
      logger.warn(
        'Booking %s offered to beautician %s but FCM was not sent.',
        appt._id,
        appt.beautician
      );
    }
    return sent;
  } catch (e) {
    logger.warn(
      'Booking %s offer notification failed for beautician %s: %s',
      appt._id,
      appt.beautician,
      e && e.message ? e.message : 'unknown error'
    );
    return false;
  }
}

/**
 * After creating an appointment document: assign first beautician + 30s offer window + FCM.
 */
async function assignInitialOffer(appointmentDoc, customerId, preferredBeauticianUserId, serviceName) {
  try {
    const profile = await pickBeauticianForBooking(customerId, preferredBeauticianUserId, [], appointmentDoc.location);
    if (!profile?.user) {
      logger.warn('No available beautician for booking %s (customer %s).', appointmentDoc._id, customerId);
      return null;
    }
    appointmentDoc.beautician = profile.user._id;
    if (profile.vendor) appointmentDoc.vendor = profile.vendor;
    appointmentDoc.offerExpiresAt = new Date(Date.now() + OFFER_MS);
    appointmentDoc.passedBeauticians = [];
    await appointmentDoc.save();
    await notifyOfferFCM(appointmentDoc, serviceName);
    return appointmentDoc;
  } catch (e) {
    logger.warn('Initial beautician offer failed for booking %s: %s', appointmentDoc._id, e.message);
    return null;
  }
}

/**
 * Decline or timeout: move offer from current beautician to next eligible expert.
 */
async function passToNextBeautician(appointmentId, fromBeauticianUserId) {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) return { ok: false, reason: 'not_found' };
  if (appt.status !== APPOINTMENT_STATUS.PENDING) {
    return { ok: false, reason: 'not_pending' };
  }
  if (!appt.beautician || String(appt.beautician) !== String(fromBeauticianUserId)) {
    return { ok: false, reason: 'wrong_assignee' };
  }

  const fromId = String(fromBeauticianUserId);
  const passed = Array.isArray(appt.passedBeauticians) ? appt.passedBeauticians.map(String) : [];
  if (!passed.includes(fromId)) {
    appt.passedBeauticians = [...(appt.passedBeauticians || []), fromBeauticianUserId];
  }

  const excludeIds = [...new Set([...appt.passedBeauticians.map(String), fromId])];
  const customerId = appt.customer;
  const profile = await pickBeauticianForBooking(customerId, null, excludeIds, appt.location);

  if (profile?.user) {
    appt.beautician = profile.user._id;
    if (profile.vendor) appt.vendor = profile.vendor;
    appt.offerExpiresAt = new Date(Date.now() + OFFER_MS);
    await appt.save();
    let serviceName = 'Service';
    try {
      const service = await Service.findById(appt.service).select('name').lean();
      serviceName = service?.name || 'Service';
    } catch (e) {
      logger.warn('Service lookup failed for booking %s: %s', appt._id, e.message);
    }
    await notifyOfferFCM(appt, serviceName);
    notificationService
      .sendFCM(customerId, {
        title: 'Finding another expert',
        body: 'Your booking is being offered to another beautician nearby.',
        data: { type: 'appointment_reassigned', appointmentId: String(appt._id) }
      })
      .catch(() => {});
    return { ok: true, cascaded: true };
  }

  appt.set('beautician', null);
  appt.set('vendor', null);
  appt.offerExpiresAt = null;
  appt.status = APPOINTMENT_STATUS.CANCELLED;
  await appt.save();

  if (appt.paymentMode === 'wallet') {
    const profile = await CustomerProfile.findOne({ user: customerId });
    if (profile) {
      profile.walletBalance = (profile.walletBalance || 0) + appt.price;
      await profile.save();
    }
  } else if (appt.paymentMode === 'online') {
    const { PAYMENT_STATUS } = require('../utils/constants');
    const payment = await Payment.findOne({ appointment: appt._id, status: PAYMENT_STATUS.PAID });
    if (payment) {
      const profile = await CustomerProfile.findOne({ user: customerId });
      if (profile) {
        profile.walletBalance = (profile.walletBalance || 0) + payment.amount;
        await profile.save();
      }
      payment.status = PAYMENT_STATUS.REFUNDED;
      await payment.save();
    }
  }
  notificationService
    .sendFCM(customerId, {
      title: 'No beautician available',
      body: 'We could not connect you with an available beautician. Please try booking again.',
      data: { type: 'appointment_unassigned', appointmentId: String(appt._id) }
    })
    .catch(() => {});
  return { ok: true, cascaded: false };
}

async function processExpiredOffers() {
  const now = new Date();
  const candidates = await Appointment.find({
    status: APPOINTMENT_STATUS.PENDING,
    beautician: { $ne: null },
    offerExpiresAt: { $lte: now }
  })
    .select('_id beautician offerExpiresAt status')
    .limit(25)
    .lean();

  for (const row of candidates) {
    const fresh = await Appointment.findById(row._id).select(
      'status beautician offerExpiresAt'
    );
    if (!fresh) continue;
    if (fresh.status !== APPOINTMENT_STATUS.PENDING || !fresh.beautician) continue;
    if (!fresh.offerExpiresAt || fresh.offerExpiresAt > new Date()) continue;
    if (String(fresh.beautician) !== String(row.beautician)) continue;
    await passToNextBeautician(fresh._id, fresh.beautician).catch((e) =>
      logger.warn('Expired offer cascade failed for %s: %s', fresh._id, e.message)
    );
  }
}

module.exports = {
  OFFER_MS,
  assignInitialOffer,
  passToNextBeautician,
  processExpiredOffers,
  notifyOfferFCM
};
