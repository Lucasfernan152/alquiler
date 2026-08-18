import { prisma } from "../lib/prisma.js";
import { getFirebaseAdmin } from "../lib/firebase.js";

async function getMessaging() {
  const admin = await getFirebaseAdmin();
  if (!admin) return null;
  return admin.messaging();
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
