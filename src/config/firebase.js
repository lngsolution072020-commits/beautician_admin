const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const env = require('./env');

let initialized = false;

function initFirebase() {
  if (initialized) return admin;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    try {
      if (admin.apps.length === 0) {
        const resolved = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
        const buf = fs.readFileSync(resolved, 'utf8');
        const serviceAccount = JSON.parse(buf);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: env.firebase?.databaseURL || `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
        });
      }
      initialized = true;
      return admin;
    } catch (err) {
      console.error('Firebase init (file) error:', err.message);
      return null;
    }
  }
  if (!env.firebase?.projectId || !env.firebase?.privateKey) {
    return null;
  }
  try {
    if (admin.apps.length === 0) {
      const databaseURL = env.firebase.databaseURL || `https://${env.firebase.projectId}-default-rtdb.firebaseio.com`;
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.firebase.projectId,
          clientEmail: env.firebase.clientEmail,
          privateKey: (env.firebase.privateKey || '').replace(/\\n/g, '\n')
        }),
        databaseURL
      });
    }
    initialized = true;
  } catch (err) {
    console.error('Firebase init error:', err.message);
    return null;
  }
  return admin;
}

module.exports = { initFirebase, get admin() { return initFirebase(); } };
