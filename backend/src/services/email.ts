import nodemailer from "nodemailer";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";

function transporter() {
  if (!env.smtp.host) return null;
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user
      ? { user: env.smtp.user, pass: env.smtp.pass }
      : undefined,
  });
}

export async function emailUnreadOlderThan(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const pending = await prisma.notification.findMany({
    where: {
      readAt: null,
      emailSentAt: null,
      createdAt: { lte: cutoff },
    },
    include: { user: true },
    take: 100,
  });

  const tx = transporter();
  for (const n of pending) {
    const link = `${env.appUrl}/notificaciones`;
    const text = `${n.body}\n\nAbrí la app: ${link}`;
    if (tx) {
      await tx.sendMail({
        from: env.smtp.from,
        to: n.user.email,
        subject: n.title,
        text,
      });
    } else {
      console.info(`[email:dev] to=${n.user.email} subject=${n.title}`);
    }
    await prisma.notification.update({
      where: { id: n.id },
      data: { emailSentAt: new Date() },
    });
  }
  return pending.length;
}
