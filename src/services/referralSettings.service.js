const ReferralSettings = require('../models/ReferralSettings');

const DEFAULTS = {
  isEnabled: false,
  customerRewardAmount: 0,
  beauticianRewardAmount: 0
};

async function ensureDoc() {
  let doc = await ReferralSettings.findOne().sort({ createdAt: 1 });
  if (!doc) {
    doc = await ReferralSettings.create(DEFAULTS);
  }
  return doc;
}

function toPublic(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    isEnabled: Boolean(o.isEnabled),
    customerRewardAmount: Number(o.customerRewardAmount) || 0,
    beauticianRewardAmount: Number(o.beauticianRewardAmount) || 0,
    updatedAt: o.updatedAt
  };
}

const getReferralSettings = async () => {
  const doc = await ensureDoc();
  return toPublic(doc);
};

const updateReferralSettings = async (payload) => {
  const doc = await ensureDoc();
  if (payload.isEnabled !== undefined) doc.isEnabled = Boolean(payload.isEnabled);
  if (payload.customerRewardAmount !== undefined) {
    doc.customerRewardAmount = Math.max(0, Number(payload.customerRewardAmount));
  }
  if (payload.beauticianRewardAmount !== undefined) {
    doc.beauticianRewardAmount = Math.max(0, Number(payload.beauticianRewardAmount));
  }
  await doc.save();
  return toPublic(doc);
};

module.exports = {
  getReferralSettings,
  updateReferralSettings
};
