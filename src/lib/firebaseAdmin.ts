import * as admin from "firebase-admin";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT env variable is not set");
}

// Convierte los saltos de línea escapados en saltos de línea reales
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT.replace(/\\n/g, '\n');
const serviceAccount = JSON.parse(serviceAccountString);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export { admin };