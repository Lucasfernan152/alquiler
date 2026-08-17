import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { env } from "./lib/env.js";
import { param } from "./lib/params.js";
import { isRemoteFilePath, publicUploadPath, streamRemoteFile } from "./lib/upload.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { requireAuthAllowQuery } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { buildingsRouter, propertiesRouter } from "./routes/buildings.js";
import { contractsRouter } from "./routes/contracts.js";
import { billingRouter } from "./routes/billing.js";
import { paymentsRouter } from "./routes/payments.js";
import { claimsRouter } from "./routes/claims.js";
import { notificationsRouter } from "./routes/notifications.js";
import { jobsRouter } from "./routes/jobs.js";

/** Orígenes del WebView de Capacitor (Android usa https, iOS capacitor://). */
const NATIVE_ORIGINS = [
  "capacitor://localhost",
  "ionic://localhost",
  "https://localhost",
  "http://localhost",
];

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (NATIVE_ORIGINS.includes(origin)) return cb(null, true);
        if (env.corsOrigins.includes(origin)) return cb(null, true);
        if (env.corsOrigins.includes("*")) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, serverless: env.isServerless }),
  );

  app.use("/api/auth", authRouter);
  app.use("/api/buildings", buildingsRouter);
  app.use("/api/properties", propertiesRouter);
  app.use("/api/contracts", contractsRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/claims", claimsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/jobs", jobsRouter);

  // Query `u` = path local o URL de Blob. Token por header o ?access_token=
  // (los <a href> del front no mandan Authorization).
  app.get("/api/files", requireAuthAllowQuery, async (req, res, next) => {
    try {
      const raw = typeof req.query.u === "string" ? req.query.u : "";
      if (!raw) {
        res.status(400).json({ error: "Falta el archivo" });
        return;
      }

      if (isRemoteFilePath(raw)) {
        const ok = await streamRemoteFile(raw, res);
        if (!ok) res.status(404).json({ error: "Archivo no encontrado" });
        return;
      }

      const file = path.basename(raw);
      const full = publicUploadPath(file);
      if (!fs.existsSync(full)) {
        res.status(404).json({ error: "Archivo no encontrado" });
        return;
      }
      res.sendFile(full);
    } catch (err) {
      next(err);
    }
  });

  // Compat con links viejos `/api/files/:filename` (disco local).
  app.get("/api/files/:filename", requireAuthAllowQuery, async (req, res, next) => {
    try {
      const raw = param(req.params.filename);
      if (isRemoteFilePath(raw)) {
        const ok = await streamRemoteFile(raw, res);
        if (!ok) res.status(404).json({ error: "Archivo no encontrado" });
        return;
      }
      const file = path.basename(raw);
      const full = publicUploadPath(file);
      if (!fs.existsSync(full)) {
        res.status(404).json({ error: "Archivo no encontrado" });
        return;
      }
      res.sendFile(full);
    } catch (err) {
      next(err);
    }
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
