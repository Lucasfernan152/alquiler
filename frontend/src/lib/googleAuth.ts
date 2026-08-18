import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";

/**
 * Obtiene un Firebase ID token vía Google Sign-In (web popup o nativo).
 */
export async function signInWithGoogle(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    await FirebaseAuthentication.signInWithGoogle();
    const { token } = await FirebaseAuthentication.getIdToken();
    if (!token) throw new Error("No se obtuvo el token de Google");
    return token;
  }

  if (!isFirebaseConfigured()) {
    throw new Error(
      "Inicio con Google no está configurado. Faltan variables VITE_FIREBASE_*.",
    );
  }

  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  const token = await result.user.getIdToken();
  if (!token) throw new Error("No se obtuvo el token de Google");
  return token;
}
