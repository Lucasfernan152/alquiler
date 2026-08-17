import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { env } from "./lib/env.js";
import { param } from "./lib/params.js";
import { isRemoteFilePath, publicUploadPath } from "./lib/upload.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { buildingsRouter, propertiesRouter } from "./routes/buildings.js";
import { contractsRouter } from "./routes/contracts.js";
import { billingRouter } from "./routes/billing.js";
import { paymentsRouter } from "./routes/payments.js";
import { claimsRouter } from "./routes/claims.js";
import { notificationsRouter } from "./routes/notifications.js";
import { jobsRouter } from "./routes/jobs.js";

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
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

  app.get("/api/files/:filename", requireAuth, (req, res) => {
    const raw = param(req.params.filename);
    // Si alguna vez guardamos una URL completa, redirigimos.
    if (isRemoteFilePath(raw)) {
      res.redirect(raw);
      return;
    }
    const file = path.basename(raw);
    const full = publicUploadPath(file);
    if (!fs.existsSync(full)) {
      res.status(404).json({ error: "Archivo no encontrado" });
      return;
    }
    res.sendFile(full);
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
