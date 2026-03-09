import * as admin from "firebase-admin";

let initialized = false;

function initAdmin() {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: privateKey!,
    }),
  });
  initialized = true;
}

export function getAdminDb(): admin.firestore.Firestore {
  initAdmin();
  return admin.firestore();
}

export function getAdminAuth(): admin.auth.Auth {
  initAdmin();
  return admin.auth();
}

// Convenience exports: these are functions returning instances,
// used like: getAdminDb().collection(...) or getAdminAuth().verifyIdToken(...)
export const adminDb = {
  collection: (...args: Parameters<admin.firestore.Firestore["collection"]>) => getAdminDb().collection(...args),
  doc: (...args: Parameters<admin.firestore.Firestore["doc"]>) => getAdminDb().doc(...args),
  batch: () => getAdminDb().batch(),
};

export const adminAuth = {
  verifyIdToken: (...args: Parameters<admin.auth.Auth["verifyIdToken"]>) => getAdminAuth().verifyIdToken(...args),
};

export default admin;
