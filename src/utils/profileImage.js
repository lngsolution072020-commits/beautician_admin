const { buildFileUrl } = require('./fileUrl');

/** Adds profileImageUrl from stored profileImage filename (uploads/profiles). */
function attachProfileImageUrl(req, userData) {
  if (!userData) return userData;
  const o =
    typeof userData.toObject === 'function'
      ? userData.toObject({ virtuals: false })
      : { ...userData };
  const raw = o.profileImage;
  if (raw && String(raw).trim() && !String(raw).startsWith('http')) {
    o.profileImageUrl = buildFileUrl(req, 'profiles', raw);
  } else {
    o.profileImageUrl = null;
  }
  return o;
}

module.exports = { attachProfileImageUrl };
