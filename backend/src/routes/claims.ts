import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { persistUpload, upload } from "../lib/upload.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { assertPropertyOwner, assertPropertyTenantOrOwner } from "../services/access.js";
import { createNotification } from "../services/notifications.js";

export const claimsRouter = Router();
claimsRouter.use(requireAuth);

claimsRouter.post("/", upload.single("photo"), async (req, res, next) => {
  try {
    const body = z
      .object({
        propertyId: z.string(),
        title: z.string().min(1),
        description: z.string().min(1),
      })
      .parse(req.body);
    const { property, isTenant } = await assertPropertyTenantOrOwner(
      body.propertyId,
      req.user!.id,
    );
    if (!isTenant) throw new AppError(403, "Solo el inquilino puede crear reclamos");
    const stored = req.file ? await persistUpload(req.file) : null;
    const claim = await prisma.claim.create({
      data: {
        propertyId: body.propertyId,
        authorId: req.user!.id,
        title: body.title,
        description: body.description,
        photoPath: stored?.filePath,
        photoName: stored?.fileName,
      },
    });
    await createNotification({
      userId: property.building.ownerId,
      type: "claim_created",
      title: "Nuevo reclamo",
      body: `${req.user!.name}: ${body.title}`,
      data: { claimId: claim.id, propertyId: body.propertyId },
    });
    res.status(201).json(claim);
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});

claimsRouter.get("/property/:propertyId", async (req, res, next) => {
  try {
    await assertPropertyTenantOrOwner(req.params.propertyId!, req.user!.id);
    const claims = await prisma.claim.findMany({
      where: { propertyId: req.params.propertyId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
    res.json(claims);
  } catch (err) {
    next(err);
  }
});

claimsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = z
      .object({
        status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
        response: z.string().optional(),
        assignedTo: z.string().optional(),
      })
      .parse(req.body);

    const claim = await prisma.claim.findUnique({
      where: { id: req.params.id },
      include: { property: { include: { building: true } } },
    });
    if (!claim) throw new AppError(404, "Reclamo no encontrado");

    const userId = req.user!.id;
    const isOwner = claim.property.building.ownerId === userId;
    const isAuthor = claim.authorId === userId;

    if (!isOwner && !isAuthor) {
      throw new AppError(403, "No autorizado");
    }

    // El inquilino solo puede confirmar la solución o reabrir si no sirvió.
    if (isAuthor && !isOwner) {
      if (!body.status || !["resolved", "open"].includes(body.status)) {
        throw new AppError(
          400,
          "Podés marcar el reclamo como resuelto o reabrirlo si no se solucionó",
        );
      }
      if (claim.status === "closed") {
        throw new AppError(400, "Este reclamo ya está cerrado");
      }
      if (body.status === "resolved" && claim.status === "resolved") {
        throw new AppError(400, "El reclamo ya está resuelto");
      }
      if (body.status === "open" && claim.status === "open") {
        throw new AppError(400, "El reclamo ya está abierto");
      }

      const note = body.response?.trim();
      let nextResponse = claim.response;
      if (body.status === "resolved") {
        const line = note || "El inquilino confirmó que quedó resuelto.";
        nextResponse = claim.response
          ? `${claim.response}\n\n${line}`
          : line;
      } else {
        const line = note
          ? `El inquilino reabrió el reclamo: ${note}`
          : "El inquilino reabrió el reclamo: no se solucionó.";
        nextResponse = claim.response
          ? `${claim.response}\n\n${line}`
          : line;
      }

      const updated = await prisma.claim.update({
        where: { id: claim.id },
        data: {
          status: body.status,
          response: nextResponse,
          assignedTo: body.status === "open" ? "" : claim.assignedTo,
        },
      });

      await createNotification({
        userId: claim.property.building.ownerId,
        type: "claim_updated",
        title:
          body.status === "resolved"
            ? "Reclamo resuelto por el inquilino"
            : "El inquilino reabrió el reclamo",
        body:
          body.status === "resolved"
            ? `${req.user!.name} confirmó que "${claim.title}" quedó resuelto.`
            : `${req.user!.name}: no se solucionó "${claim.title}".${note ? ` ${note}` : ""}`,
        data: { claimId: claim.id, propertyId: claim.propertyId },
      });

      res.json(updated);
      return;
    }

    await assertPropertyOwner(claim.propertyId, userId);
    const updated = await prisma.claim.update({
      where: { id: claim.id },
      data: {
        status: body.status,
        response: body.response,
        assignedTo: body.assignedTo,
        responderId: userId,
      },
    });
    await createNotification({
      userId: claim.authorId,
      type: "claim_updated",
      title: "Actualización de reclamo",
      body: body.response || `Estado: ${body.status ?? claim.status}`,
      data: { claimId: claim.id, propertyId: claim.propertyId },
    });
    res.json(updated);
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});
