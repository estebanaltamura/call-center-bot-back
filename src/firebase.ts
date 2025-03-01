import * as admin from "firebase-admin";

// Ruta al archivo de clave de servicio descargado
const serviceAccount = require("../firebase-key.json");

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const db = admin.firestore(); // Exporta la instancia de Firestore