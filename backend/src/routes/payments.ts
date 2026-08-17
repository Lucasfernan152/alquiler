import { Router } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { prisma } from "../lib/prisma.js";
import { persistUpload, upload } from "../lib/upload.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { assertPropertyOwner } from "../services/access.js";
import { createNotification } from "../services/notifications.js";

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

paymentsRouter.post(
  "/periods/:periodId",
  upload.single("proof"),
  async (req, res, next) => {
    try {
      const period = await prisma.billingPeriod.findUnique({
        where: { id: param(req.params.periodId) },
        include: {
          property: {
            include: {
              building: true,
              tenancies: { where: { tenantId: req.user!.id, active: true } },
            },
          },
        },
      });
      if (!period) throw new AppError(404, "Período no encontrado");
      if (period.property.tenancies.length === 0) {
        throw new AppError(403, "Solo el inquilino puede subir comprobantes");
      }
      if (period.status !== "ready" && period.status !== "settled") {
        throw new AppError(400, "El período aún no está listo para pagar");
      }
      const body = z.object({ amount: z.coerce.number().positive() }).parse(req.body);
      const stored = req.file ? await persistUpload(req.file) : null;
      const payment = await prisma.payment.create({
        data: {
          billingPeriodId: period.id,
          tenantId: req.user!.id,
          amount: body.amount,
          proofPath: stored?.filePath,
          proofName: stored?.fileName,
          status: "pending",
        },
      });
      await createNotification({
        userId: period.property.building.ownerId,
        type: "payment_submitted",
        title: "Nuevo comprobante de pago",
        body: `${req.user!.name} subió un comprobante por $${body.amount.toFixed(2)} (${period.label})`,
      data: {
          paymentId: payment.id,
          billingPeriodId: period.id,
          propertyId: period.propertyId,
        },
      });
      res.status(201).json(payment);
    } catch (err) {
      next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
    }
  },
);

paymentsRouter.patch("/:id/review", async (req, res, next) => {
  try {
    const body = z
      .object({
        status: z.enum(["approved", "rejected"]),
        reviewNote: z.string().optional(),
      })
      .parse(req.body);
    const payment = await prisma.payment.findUnique({
      where: { id: param(req.params.id) },
      include: {
        billingPeriod: { include: { property: { include: { building: true } } } },
      },
    });
    if (!payment) throw new AppError(404, "Pago no encontrado");
    await assertPropertyOwner(payment.billingPeriod.propertyId, req.user!.id);
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: body.status,
        reviewNote: body.reviewNote ?? "",
      },
    });
    if (body.status === "approved") {
      await prisma.billingPeriod.update({
        where: { id: payment.billingPeriodId },
        data: { status: "settled" },
      });
    }
    await createNotification({
      userId: payment.tenantId,
      type: "payment_reviewed",
      title: body.status === "approved" ? "Pago aprobado" : "Pago rechazado",
      body:
        body.status === "approved"
          ? "Tu comprobante fue validado por el dueño."
          : `Tu comprobante fue rechazado. ${body.reviewNote ?? ""}`.trim(),
      data: {
        paymentId: payment.id,
        billingPeriodId: payment.billingPeriodId,
        propertyId: payment.billingPeriod.propertyId,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});
