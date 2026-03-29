const PlatformCommissionSettings = require('../models/PlatformCommissionSettings');

const DEFAULTS = {
  beauticianCommissionPercent: 10,
  vendorCommissionPercent: 10
};

async function ensureDoc() {
  let doc = await PlatformCommissionSettings.findOne().sort({ createdAt: 1 });
  if (!doc) {
    doc = await PlatformCommissionSettings.create(DEFAULTS);
  }
  return doc;
}

function clampPercent(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.min(100, Math.max(0, x));
}

function toPublic(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    beauticianCommissionPercent: clampPercent(o.beauticianCommissionPercent),
    vendorCommissionPercent: clampPercent(o.vendorCommissionPercent),
    updatedAt: o.updatedAt
  };
}

const getPlatformCommissionSettings = async () => {
  const doc = await ensureDoc();
  return toPublic(doc);
};

const updatePlatformCommissionSettings = async (payload) => {
  const doc = await ensureDoc();
  if (payload.beauticianCommissionPercent !== undefined) {
    doc.beauticianCommissionPercent = clampPercent(payload.beauticianCommissionPercent);
  }
  if (payload.vendorCommissionPercent !== undefined) {
    doc.vendorCommissionPercent = clampPercent(payload.vendorCommissionPercent);
  }
  await doc.save();
  return toPublic(doc);
};

module.exports = {
  getPlatformCommissionSettings,
  updatePlatformCommissionSettings
};
