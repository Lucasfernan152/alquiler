import { prisma } from "../lib/prisma.js";

let firebaseReady = false;

async function getMessaging() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const admin = await import("firebase-admin");
    if (!firebaseReady) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      const cred =
        raw.startsWith("{") ? JSON.parse(raw) : JSON.parse(await (await import("node:fs/promises")).readFile(raw, "utf8"));
      admin.default.initializeApp({
        credential: admin.default.credential.cert(cred),
      });
      firebaseReady = true;
    }
    return admin.default.messaging();
  } catch (err) {
    console.warn("Firebase no configurado; push omitido", err);
    return null;
  }
}

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: string,
) {
  return prisma.deviceToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform },
  });
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;
  const messaging = await getMessaging();
  if (!messaging) {
    console.info(`[push:dev] ${userId}: ${title} — ${body}`);
    return;
  }
  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)]),
  );
  await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
    data: stringData,
  });
}
