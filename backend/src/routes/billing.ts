import { Router } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { prisma } from "../lib/prisma.js";
import { persistUpload, upload } from "../lib/upload.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { assertPropertyTenantOrOwner } from "../services/access.js";
import {
  addOrReplaceInvoice,
  deleteInvoice,
  markPeriodReady,
  maybeAutoMarkPeriodReady,
  ownerMonthSummary,
  updateInvoice,
} from "../services/billing.js";

export const billingRouter = Router();
billingRouter.use(requireAuth);

billingRouter.get("/month-summary", async (req, res, next) => {
  try {
    const summary = await ownerMonthSummary(req.user!.id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

billingRouter.post("/periods", async (_req, res) => {
  // Los períodos se crean solos desde el inicio del contrato.
  res.status(410).json({
    error: "Los períodos se generan automáticamente. No hace falta crearlos a mano.",
  });
});

billingRouter.get("/periods/:id", async (req, res, next) => {
  try {
    const period = await prisma.billingPeriod.findUnique({
      where: { id: param(req.params.id) },
      include: {
        invoices: true,
        payments: {
          include: { tenant: { select: { id: true, name: true, email: true } } },
        },
        property: { include: { building: true } },
      },
    });
    if (!period) throw new AppError(404, "Período no encontrado");
    await assertPropertyTenantOrOwner(period.propertyId, req.user!.id);
    res.json(period);
  } catch (err) {
    next(err);
  }
});

billingRouter.post(
  "/periods/:id/invoices",
  upload.single("file"),
  async (req, res, next) => {
    try {
      const periodId = param(req.params.id);
      const body = z
        .object({
          type: z.string().min(1),
          amount: z.coerce.number().nonnegative(),
          notes: z.string().optional(),
        })
        .parse(req.body);
      const stored = req.file ? await persistUpload(req.file) : null;
      const invoice = await addOrReplaceInvoice(periodId, req.user!.id, {
        type: body.type,
        amount: body.amount,
        notes: body.notes,
        file: stored,
      });
      // Si era la última del preset, avisamos solos al inquilino.
      const auto = await maybeAutoMarkPeriodReady(periodId, req.user!.id);
      res.status(201).json({
        ...invoice,
        periodReady: Boolean(auto),
      });
    } catch (err) {
      next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
    }
  },
);

billingRouter.patch(
  "/periods/:id/invoices/:invoiceId",
  upload.single("file"),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          type: z.string().min(1).optional(),
          amount: z.coerce.number().nonnegative().optional(),
          notes: z.string().optional(),
        })
        .parse(req.body);
      const stored = req.file ? await persistUpload(req.file) : null;
      const invoice = await updateInvoice(
        param(req.params.id),
        param(req.params.invoiceId),
        req.user!.id,
        {
          type: body.type,
          amount: body.amount,
          notes: body.notes,
          file: stored,
        },
      );
      res.json(invoice);
    } catch (err) {
      next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
    }
  },
);

billingRouter.delete("/periods/:id/invoices/:invoiceId", async (req, res, next) => {
  try {
    await deleteInvoice(param(req.params.id), param(req.params.invoiceId), req.user!.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

billingRouter.post("/periods/:id/ready", async (req, res, next) => {
  try {
    const result = await markPeriodReady(param(req.params.id), req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
