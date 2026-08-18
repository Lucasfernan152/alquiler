import { Router } from "express";
import { env } from "../lib/env.js";
import { AppError } from "../middleware/error.js";
import {
  ensureBillingPeriodsForAll,
  remindOwnersToUploadInvoices,
  remindTenantsToPay,
} from "../services/billing.js";
import { remindOwnersOfContractEnding, remindRentIncrease } from "../services/contracts.js";
import { emailUnreadOlderThan } from "../services/email.js";

export const jobsRouter = Router();

function requireCron(req: { headers: { authorization?: string } }, _res: unknown, next: (err?: unknown) => void) {
  // En local sin secreto: permitir para pruebas.
  if (!env.cronSecret && !env.isServerless) {
    next();
    return;
  }
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!env.cronSecret || token !== env.cronSecret) {
    next(new AppError(401, "Cron no autorizado"));
    return;
  }
  next();
}

jobsRouter.post("/email-unread", requireCron, async (_req, res, next) => {
  try {
    const count = await emailUnreadOlderThan(24);
    res.json({ ok: true, emailed: count });
  } catch (err) {
    next(err);
  }
});

jobsRouter.get("/email-unread", requireCron, async (_req, res, next) => {
  try {
    const count = await emailUnreadOlderThan(24);
    res.json({ ok: true, emailed: count });
  } catch (err) {
    next(err);
  }
});

jobsRouter.post("/ensure-periods", requireCron, async (_req, res, next) => {
  try {
    const created = await ensureBillingPeriodsForAll();
    res.json({ ok: true, created });
  } catch (err) {
    next(err);
  }
});

jobsRouter.get("/ensure-periods", requireCron, async (_req, res, next) => {
  try {
    const created = await ensureBillingPeriodsForAll();
    res.json({ ok: true, created });
  } catch (err) {
    next(err);
  }
});

async function runDaily() {
  const emailed = await emailUnreadOlderThan(24);
  const created = await ensureBillingPeriodsForAll();
  const ownerReminders = await remindOwnersToUploadInvoices(10);
  const contractEnding = await remindOwnersOfContractEnding([2, 1]);
  const rentIncrease = await remindRentIncrease([30, 15]);
  const paymentReminders = await remindTenantsToPay([3, 7]);
  return {
    ok: true as const,
    emailed,
    created,
    ownerReminders,
    contractEnding,
    rentIncrease,
    paymentReminders,
  };
}

jobsRouter.get("/daily", requireCron, async (_req, res, next) => {
  try {
    res.json(await runDaily());
  } catch (err) {
    next(err);
  }
});

jobsRouter.post("/daily", requireCron, async (_req, res, next) => {
  try {
    res.json(await runDaily());
  } catch (err) {
    next(err);
  }
});
