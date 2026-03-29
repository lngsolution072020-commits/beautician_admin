const User = require('../models/User');
const { getEtaBetweenPoints } = require('../utils/location');
const logger = require('../config/logger');

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

async function writeRealtimeLocation(appointmentId, lat, lng, eta) {
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
  try {
    const ref = db.ref(`location/${appointmentId}`);
    await ref.set({
      lat,
      lng,
      etaMinutes: eta?.etaInMinutes ?? null,
      distanceKm: eta?.distanceInKm ?? null,
      updatedAt: Date.now()
    });
    logger.info('Firebase RTDB: location updated for appointment %s', appointmentId);
  } catch (err) {
    logger.warn('Firebase RTDB write failed for appointment %s: %s', appointmentId, err.message);
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

async function notifyLocationUpdate(appointmentId, lat, lng, destinationLat, destinationLng) {
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
  await writeRealtimeLocation(appointmentId, lat, lng, eta);
  return eta;
}

module.exports = {
  sendFCM,
  sendFCMToToken,
  writeRealtimeLocation,
  emitLocationToSocket,
  notifyLocationUpdate
};
