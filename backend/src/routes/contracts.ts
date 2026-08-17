import { Router } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { prisma } from "../lib/prisma.js";
import { persistUpload, upload } from "../lib/upload.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { assertPropertyOwner } from "../services/access.js";
import { ensureBillingPeriods } from "../services/billing.js";
import { createNotification } from "../services/notifications.js";

export const contractsRouter = Router();
contractsRouter.use(requireAuth);

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
        increaseNote: z.string().optional(),
        startDate: z.string(),
        endDate: z.string().optional(),
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
    const startDate = new Date(body.startDate);
    const nextIncreaseDate = body.nextIncreaseDate
      ? new Date(body.nextIncreaseDate)
      : (() => {
          const next = new Date(startDate);
          next.setMonth(next.getMonth() + increaseEveryMonths);
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
    const contract = await prisma.contract.create({
      data: {
        propertyId,
        rentAmount: body.rentAmount,
        currency: body.currency ?? "ARS",
        increaseEveryMonths,
        nextIncreaseDate,
        increaseNote: body.increaseNote ?? "",
        requiredInvoiceTypes,
        startDate,
        endDate: body.endDate ? new Date(body.endDate) : null,
        filePath: stored?.filePath ?? previous?.filePath,
        fileName: stored?.fileName ?? previous?.fileName,
        active: true,
      },
    });
    await ensureBillingPeriods(propertyId);

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

    res.status(201).json(contract);
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});
