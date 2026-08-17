import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function splitOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required("DATABASE_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? "15m",
  /** Sesión “siempre abierta”: 1 año. Solo se corta con logout explícito. */
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? "365d",
  uploadDir: path.resolve(
    process.env.UPLOAD_DIR ?? path.join(__dirname, "../../uploads"),
  ),
  /** Si está seteado, los archivos van a Vercel Blob en vez del disco. */
  blobToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  corsOrigins: splitOrigins(
    process.env.CORS_ORIGIN ?? "http://localhost:5173",
  ),
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "Alquiler <noreply@alquiler.local>",
  },
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT ?? "",
  /** true en Vercel / serverless (sin disco persistente ni node-cron). */
  isServerless: Boolean(process.env.VERCEL),
};

/** Tope de upload: Vercel Hobby limita el body ~4.5 MB. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
