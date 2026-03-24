const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const BeauticianProfile = require('../models/BeauticianProfile');
const CustomerProfile = require('../models/CustomerProfile');
const { APPOINTMENT_STATUS } = require('../utils/constants');

async function recalculateBeauticianAverageRating(beauticianUserId) {
  const bid = new mongoose.Types.ObjectId(beauticianUserId);
  const [row] = await Appointment.aggregate([
    {
      $match: {
        beautician: bid,
        status: APPOINTMENT_STATUS.COMPLETED,
        'ratingFromCustomer.stars': { $exists: true, $ne: null }
      }
    },
    { $group: { _id: null, avg: { $avg: '$ratingFromCustomer.stars' } } }
  ]);
  const avg = row?.avg != null ? Math.round(row.avg * 10) / 10 : 0;
  const profile = await BeauticianProfile.findOne({ user: beauticianUserId });
  if (profile) {
    profile.rating = avg;
    await profile.save();
  }
}

async function recalculateCustomerAverageRating(customerUserId) {
  const cid = new mongoose.Types.ObjectId(customerUserId);
  const [row] = await Appointment.aggregate([
    {
      $match: {
        customer: cid,
        status: APPOINTMENT_STATUS.COMPLETED,
        'ratingFromBeautician.stars': { $exists: true, $ne: null }
      }
    },
    { $group: { _id: null, avg: { $avg: '$ratingFromBeautician.stars' }, n: { $sum: 1 } } }
  ]);
  const avg = row?.avg != null ? Math.round(row.avg * 10) / 10 : 0;
  const count = row?.n ?? 0;
  const profile = await CustomerProfile.findOne({ user: customerUserId });
  if (profile) {
    profile.rating = avg;
    profile.ratingCount = count;
    await profile.save();
  }
}

async function countPendingCustomerRatings(customerId) {
  return Appointment.countDocuments({
    customer: customerId,
    status: APPOINTMENT_STATUS.COMPLETED,
    'ratingFromCustomer.stars': { $exists: false }
  });
}

async function countPendingBeauticianRatings(beauticianId) {
  return Appointment.countDocuments({
    beautician: beauticianId,
    status: APPOINTMENT_STATUS.COMPLETED,
    'ratingFromBeautician.stars': { $exists: false }
  });
}

module.exports = {
  recalculateBeauticianAverageRating,
  recalculateCustomerAverageRating,
  countPendingCustomerRatings,
  countPendingBeauticianRatings
};
