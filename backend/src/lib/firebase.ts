import type { Auth } from "firebase-admin/auth";
import type { Messaging } from "firebase-admin/messaging";
import type { App } from "firebase-admin/app";
import { env } from "./env.js";

export type FirebaseAdminApi = {
  auth(): Auth;
  messaging(): Messaging;
  apps: (App | null)[];
};

let cached: FirebaseAdminApi | null = null;

/** Inicializa firebase-admin una sola vez (push + auth Google). */
export async function getFirebaseAdmin(): Promise<FirebaseAdminApi | null> {
  if (!env.firebaseServiceAccount) return null;
  if (cached) return cached;
  try {
    const admin = (await import("firebase-admin")).default;
    if (!admin.apps.length) {
      const raw = env.firebaseServiceAccount;
      const cred = raw.startsWith("{")
        ? JSON.parse(raw)
        : JSON.parse(
            await (await import("node:fs/promises")).readFile(raw, "utf8"),
          );
      admin.initializeApp({
        credential: admin.credential.cert(cred),
      });
    }
    cached = admin;
    return cached;
  } catch (err) {
    console.warn("Firebase no configurado", err);
    return null;
  }
}
