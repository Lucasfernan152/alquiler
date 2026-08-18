import { Router } from "express";
import { z } from "zod";
import { parseIncreasePercent } from "../domain/contracts.js";
import { calendarDate } from "../lib/dates.js";
import { param } from "../lib/params.js";
import { prisma } from "../lib/prisma.js";
import { persistUpload, upload } from "../lib/upload.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { assertPropertyOwner } from "../services/access.js";
import { applyRentToOpenPeriods, ensureBillingPeriods } from "../services/billing.js";
import { enrichContractWithEstimate, recordRentChange, applyRentIncrease } from "../services/contracts.js";
import { createNotification } from "../services/notifications.js";

export const contractsRouter = Router();
contractsRouter.use(requireAuth);

contractsRouter.post(
  "/:propertyId/apply-increase",
  async (req, res, next) => {
    try {
      const propertyId = param(req.params.propertyId);
      const body = z
        .object({
          amount: z.coerce.number().positive().optional(),
        })
        .parse(req.body ?? {});
      const contract = await applyRentIncrease(propertyId, req.user!.id, {
        amount: body.amount,
      });
      res.json(contract);
    } catch (err) {
      next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
    }
  },
);

contractsRouter.post("/:propertyId", upload.single("file"), async (req, res, next) => {
  try {
    const propertyId = param(req.params.propertyId);
    await assertPropertyOwner(propertyId, req.user!.id);
    const body = z
      .object({
        rentAmount: z.coerce.number().positive(),
        currency: z.string().optional(),
        increaseEveryMonths: z.coerce.number().int().positive().optional(),
        nextIncreaseDate: z.string().optional(),
        increaseMethod: z.enum(["ipc", "icl", "fixed", "other"]).optional(),
        increaseNote: z.string().optional(),
        estimatedIncreasePct: z.coerce.number().min(0).max(500).optional(),
        startDate: z.string(),
        endDate: z.string().min(1),
        requiredInvoiceTypes: z.string().optional(),
      })
      .parse(req.body);

    // Si el dueño edita sin volver a subir el PDF, la nueva versión hereda el archivo.
    const previous = await prisma.contract.findFirst({
      where: { propertyId, active: true },
      orderBy: { createdAt: "desc" },
    });

    await prisma.contract.updateMany({
      where: { propertyId, active: true },
      data: { active: false },
    });

    const increaseEveryMonths = body.increaseEveryMonths ?? 12;
    const startDate = calendarDate(body.startDate);
    if (!startDate) throw new AppError(400, "Fecha de inicio inválida");

    const nextIncreaseDate =
      (body.nextIncreaseDate ? calendarDate(body.nextIncreaseDate) : null) ??
      (() => {
        const next = new Date(startDate);
        next.setUTCMonth(next.getUTCMonth() + increaseEveryMonths);
        return next;
      })();

    let requiredInvoiceTypes = "[]";
    if (body.requiredInvoiceTypes) {
      try {
        const parsed = JSON.parse(body.requiredInvoiceTypes) as unknown;
        if (!Array.isArray(parsed)) throw new Error("invalid");
        const cleaned = parsed
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter(Boolean);
        requiredInvoiceTypes = JSON.stringify(cleaned);
      } catch {
        throw new AppError(400, "Preset de facturas inválido");
      }
    }

    const stored = req.file ? await persistUpload(req.file) : null;
    const endDate = calendarDate(body.endDate);
    if (!endDate || endDate <= startDate) {
      throw new AppError(400, "La fecha de fin debe ser posterior al inicio");
    }

    const increaseMethod = body.increaseMethod ?? "ipc";
    const increaseNote = body.increaseNote?.trim() ?? "";
    // Solo el aumento fijo guarda %; IPC/ICL se calculan solos con la API.
    const estimatedIncreasePct =
      increaseMethod === "fixed"
        ? (body.estimatedIncreasePct ?? parseIncreasePercent(increaseNote))
        : null;

    const contract = await prisma.contract.create({
      data: {
        propertyId,
        rentAmount: body.rentAmount,
        currency: body.currency ?? "ARS",
        increaseEveryMonths,
        nextIncreaseDate,
        increaseMethod,
        increaseNote,
        estimatedIncreasePct: estimatedIncreasePct ?? null,
        requiredInvoiceTypes,
        startDate,
        endDate,
        filePath: stored?.filePath ?? previous?.filePath,
        fileName: stored?.fileName ?? previous?.fileName,
        active: true,
      },
    });
    await ensureBillingPeriods(propertyId);

    if (!previous) {
      await recordRentChange({
        propertyId,
        previousAmount: null,
        newAmount: body.rentAmount,
        kind: "initial",
        method: increaseMethod,
        note: "Alquiler inicial del contrato",
        effectiveDate: startDate,
      });
    } else if (body.rentAmount !== previous.rentAmount) {
      await applyRentToOpenPeriods(propertyId, body.rentAmount, new Date());
      const pct =
        previous.rentAmount > 0
          ? Math.round(
              ((body.rentAmount - previous.rentAmount) / previous.rentAmount) *
                10000,
            ) / 100
          : null;
      await recordRentChange({
        propertyId,
        previousAmount: previous.rentAmount,
        newAmount: body.rentAmount,
        increasePct: pct,
        kind: "manual",
        method: increaseMethod,
        note: "Cambio al editar el contrato",
        effectiveDate: new Date(),
      });
    }

    if (previous && body.rentAmount > previous.rentAmount) {
      const tenants = await prisma.tenancy.findMany({
        where: { propertyId, active: true },
      });
      const from = previous.rentAmount.toFixed(2);
      const to = body.rentAmount.toFixed(2);
      for (const tenancy of tenants) {
        await createNotification({
          userId: tenancy.tenantId,
          type: "rent_increase",
          title: "Aumentó el alquiler",
          body: `El alquiler pasa de $${from} a $${to}.`,
          data: {
            propertyId,
            contractId: contract.id,
            previousRent: previous.rentAmount,
            rentAmount: body.rentAmount,
          },
        });
      }
    }

    res.status(201).json(await enrichContractWithEstimate(contract));
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});
