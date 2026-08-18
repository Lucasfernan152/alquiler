import { Router } from "express";
import { z } from "zod";
import { param } from "../lib/params.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import {
  acceptTenantInvite,
  createTenantInvite,
  getInvitePreview,
} from "../services/invites.js";

export const invitesRouter = Router();

invitesRouter.get("/:token", async (req, res, next) => {
  try {
    const preview = await getInvitePreview(param(req.params.token));
    res.json(preview);
  } catch (err) {
    next(err);
  }
});

invitesRouter.post("/:token/accept", requireAuth, async (req, res, next) => {
  try {
    const result = await acceptTenantInvite(param(req.params.token), req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Crear invite: montado también desde properties. */
export async function createInviteHandler(
  propertyId: string,
  ownerId: string,
  body: unknown,
) {
  const parsed = z
    .object({
      sharePercentage: z.number().min(0).max(100).optional(),
    })
    .parse(body ?? {});
  return createTenantInvite(propertyId, ownerId, parsed.sharePercentage ?? 100);
}

export function mountPropertyInviteRoute(router: Router) {
  router.post("/:id/invites", async (req, res, next) => {
    try {
      const invite = await createInviteHandler(
        param(req.params.id),
        req.user!.id,
        req.body,
      );
      res.status(201).json(invite);
    } catch (err) {
      next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
    }
  });
}
