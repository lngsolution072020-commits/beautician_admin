const SystemSettings = require('../models/SystemSettings');

const getSettings = async () => {
  let settings = await SystemSettings.findOne().lean();
  if (!settings) {
    settings = await SystemSettings.create({ beauticianMaxDistanceKm: 10, gstPercent: 0 });
    settings = settings.toObject();
  }
  return settings;
};

const updateSettings = async (payload) => {
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create({ beauticianMaxDistanceKm: 10, gstPercent: 0 });
  }
  
  if (payload.beauticianMaxDistanceKm !== undefined) {
    settings.beauticianMaxDistanceKm = Math.max(1, Number(payload.beauticianMaxDistanceKm));
  }
  if (payload.gstPercent !== undefined) {
    settings.gstPercent = Math.max(0, Number(payload.gstPercent));
  }
  await settings.save();
  return settings;
};

module.exports = {
  getSettings,
  updateSettings
};
