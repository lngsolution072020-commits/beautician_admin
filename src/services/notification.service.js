const User = require('../models/User');
const BeauticianProfile = require('../models/BeauticianProfile');
const { getEtaBetweenPoints } = require('../utils/location');
const { APPOINTMENT_STATUS } = require('../utils/constants');
const logger = require('../config/logger');

/** RTDB `beauticianPresence/{id}.status`: offline | online | busy */
function derivePresenceStatus(isAvailable, appointmentStatus) {
  if (isAvailable === false) return 'offline';
  const s = appointmentStatus ? String(appointmentStatus) : '';
  if (
    s === APPOINTMENT_STATUS.ACCEPTED ||
    s === APPOINTMENT_STATUS.IN_TRANSIT ||
    s === APPOINTMENT_STATUS.REACHED ||
    s === APPOINTMENT_STATUS.IN_PROGRESS
  ) {
    return 'busy';
  }
  return 'online';
}

function getFirebaseAdmin() {
  try {
    const { admin } = require('../config/firebase');
    return admin;
  } catch {
    return null;
  }
}

async function sendFCM(userId, { title, body, data = {} }) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    logger.warn('FCM skipped: Firebase Admin not initialized (set GOOGLE_APPLICATION_CREDENTIALS). user=%s', userId);
    return false;
  }
  const user = await User.findById(userId).select('fcmToken').lean();
  if (!user?.fcmToken) {
    logger.warn('FCM skipped: user %s has no fcmToken (open beautician app once and allow notifications)', userId);
    return false;
  }
  try {
    await admin.messaging().send({
      token: user.fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    });
    return true;
  } catch (err) {
    logger.warn('FCM send failed for user %s: %s', userId, err.message);
    return false;
  }
}

/** Send FCM to a specific token (e.g. for OTP before login) */
async function sendFCMToToken(token, { title, body, data = {} }) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    logger.warn('FCM: Firebase Admin not initialized. Set GOOGLE_APPLICATION_CREDENTIALS in .env');
    return false;
  }
  if (!token) return false;
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    });
    return true;
  } catch (err) {
    logger.warn('FCM send to token failed:', err.message, err.code || '', err.details || '');
    return false;
  }
}

async function writeRealtimeLocation(
  appointmentId,
  lat,
  lng,
  eta,
  beauticianUserId,
  appointmentStatus,
  isAvailable
) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    logger.warn('Firebase RTDB: Admin not initialized. Set GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_DATABASE_URL in .env');
    return;
  }
  let db;
  try {
    db = admin.database();
  } catch (err) {
    logger.warn('Firebase RTDB: database() failed. Ensure FIREBASE_DATABASE_URL is set in .env (e.g. https://YOUR_PROJECT-default-rtdb.firebaseio.com)', err.message);
    return;
  }
  if (!db) {
    logger.warn('Firebase RTDB: database() returned null. Check FIREBASE_DATABASE_URL in .env');
    return;
  }
  const bid = beauticianUserId ? String(beauticianUserId) : '';
  try {
    const ref = db.ref(`location/${appointmentId}`);
    await ref.set({
      lat,
      lng,
      beauticianId: bid,
      appointmentId: String(appointmentId),
      etaMinutes: eta?.etaInMinutes ?? null,
      distanceKm: eta?.distanceInKm ?? null,
      updatedAt: Date.now()
    });
    logger.info('Firebase RTDB: location/%s updated (beautician %s)', appointmentId, bid || '—');
  } catch (err) {
    logger.warn('Firebase RTDB write failed for appointment %s: %s', appointmentId, err.message);
  }
  if (bid) {
    try {
      const status = derivePresenceStatus(isAvailable !== false, appointmentStatus);
      await db.ref(`beauticianPresence/${bid}`).update({
        beauticianId: bid,
        status,
        isAvailable: isAvailable !== false,
        lat,
        lng,
        appointmentId: String(appointmentId),
        updatedAt: Date.now()
      });
      logger.info('Firebase RTDB: beauticianPresence/%s status=%s', bid, status);
    } catch (err) {
      logger.warn('Firebase RTDB beauticianPresence write failed for %s: %s', bid, err.message);
    }
  }
}

/** When beautician toggles online/offline in the app — keeps id + status (+ clears coords when going offline). */
async function syncBeauticianPresenceFromAvailability(beauticianUserId, isAvailable) {
  const bid = beauticianUserId ? String(beauticianUserId) : '';
  if (!bid) return;
  const admin = getFirebaseAdmin();
  if (!admin) return;
  let db;
  try {
    db = admin.database();
  } catch {
    return;
  }
  try {
    const status = isAvailable ? 'online' : 'offline';
    const patch = {
      beauticianId: bid,
      isAvailable: !!isAvailable,
      status,
      updatedAt: Date.now()
    };
    if (!isAvailable) {
      patch.lat = null;
      patch.lng = null;
      patch.appointmentId = null;
    }
    await db.ref(`beauticianPresence/${bid}`).update(patch);
    logger.info('Firebase RTDB: beauticianPresence/%s availability → %s', bid, status);
  } catch (err) {
    logger.warn('Firebase RTDB beauticianPresence availability sync failed for %s: %s', bid, err.message);
  }
}

/** After job completes: clear active job + coords; set online/offline from DB profile. */
async function refreshBeauticianPresenceAfterJobComplete(beauticianUserId) {
  const bid = beauticianUserId ? String(beauticianUserId) : '';
  if (!bid) return;
  const admin = getFirebaseAdmin();
  if (!admin) return;
  let db;
  try {
    db = admin.database();
  } catch {
    return;
  }
  try {
    const profile = await BeauticianProfile.findOne({ user: bid }).select('isAvailable').lean();
    const isAvail = profile?.isAvailable !== false;
    const status = isAvail ? 'online' : 'offline';
    await db.ref(`beauticianPresence/${bid}`).update({
      beauticianId: bid,
      status,
      isAvailable: isAvail,
      lat: null,
      lng: null,
      appointmentId: null,
      updatedAt: Date.now()
    });
    logger.info('Firebase RTDB: beauticianPresence/%s refreshed after job (status=%s)', bid, status);
  } catch (err) {
    logger.warn('Firebase RTDB beauticianPresence post-complete refresh failed for %s: %s', bid, err.message);
  }
}

async function emitLocationToSocket(io, appointmentId, lat, lng, eta) {
  if (!io) return;
  try {
    io.to(`appointment:${appointmentId}`).emit('location', { lat, lng, eta });
  } catch (err) {
    logger.warn('Socket emit failed:', err.message);
  }
}

async function notifyLocationUpdate(
  appointmentId,
  lat,
  lng,
  destinationLat,
  destinationLng,
  beauticianUserId,
  appointmentStatus,
  isAvailable
) {
  let eta = null;
  if (destinationLat != null && destinationLng != null) {
    try {
      eta = await getEtaBetweenPoints(
        { origin: { lat, lng }, destination: { lat: destinationLat, lng: destinationLng } }
      );
    } catch {
      // ignore
    }
  }
  await writeRealtimeLocation(appointmentId, lat, lng, eta, beauticianUserId, appointmentStatus, isAvailable);
  return eta;
}

module.exports = {
  sendFCM,
  sendFCMToToken,
  writeRealtimeLocation,
  syncBeauticianPresenceFromAvailability,
  refreshBeauticianPresenceAfterJobComplete,
  emitLocationToSocket,
  notifyLocationUpdate
};
