import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications.js";
import { registerDeviceToken } from "../services/push.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const items = await listNotifications(req.user!.id);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/:id/read", async (req, res, next) => {
  try {
    const n = await markNotificationRead(req.user!.id, req.params.id!);
    if (!n) throw new AppError(404, "Notificación no encontrada");
    res.json(n);
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/read-all", async (req, res, next) => {
  try {
    await markAllNotificationsRead(req.user!.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/device-token", async (req, res, next) => {
  try {
    const body = z
      .object({
        token: z.string().min(1),
        platform: z.enum(["ios", "android", "web"]).default("web"),
      })
      .parse(req.body);
    const saved = await registerDeviceToken(req.user!.id, body.token, body.platform);
    res.status(201).json(saved);
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});
