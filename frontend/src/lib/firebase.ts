import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY ?? ""),
  authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? ""),
  projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID ?? ""),
  appId: String(import.meta.env.VITE_FIREBASE_APP_ID ?? ""),
  messagingSenderId: String(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  ),
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function isFirebaseConfigured() {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase no está configurado");
  }
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
  }
  return auth!;
}
