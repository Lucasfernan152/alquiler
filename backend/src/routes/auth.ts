import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import { getFirebaseAdmin } from "../lib/firebase.js";
import {
  requireAuth,
  signAccessToken,
  signRefreshToken,
  type AuthUser,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";

const googleSchema = z.object({
  idToken: z.string().min(1),
});

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().trim().max(40).optional(),
  paymentAlias: z.string().trim().max(80).optional(),
  paymentCbu: z.string().trim().max(40).optional(),
  paymentHolder: z.string().trim().max(120).optional(),
});

const meSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  paymentAlias: true,
  paymentCbu: true,
  paymentHolder: true,
  buildings: { select: { id: true }, take: 1 },
  tenancies: { where: { active: true }, select: { id: true }, take: 1 },
} as const;

function toMeJson(user: {
  id: string;
  email: string;
  name: string;
  phone: string;
  paymentAlias: string;
  paymentCbu: string;
  paymentHolder: string;
  buildings: { id: string }[];
  tenancies: { id: string }[];
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    paymentAlias: user.paymentAlias,
    paymentCbu: user.paymentCbu,
    paymentHolder: user.paymentHolder,
    isOwner: user.buildings.length > 0,
    isTenant: user.tenancies.length > 0,
  };
}

function authPayload(user: { id: string; email: string; name: string; phone: string }) {
  const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
  return {
    user: { ...authUser, phone: user.phone },
    accessToken: signAccessToken(authUser),
    refreshToken: signRefreshToken(authUser),
  };
}

export const authRouter = Router();

authRouter.post("/google", async (req, res, next) => {
  try {
    const body = googleSchema.parse(req.body);
    const admin = await getFirebaseAdmin();
    if (!admin) {
      throw new AppError(503, "Inicio con Google no está configurado");
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(body.idToken);
    } catch {
      throw new AppError(401, "Token de Google inválido");
    }

    const firebaseUid = decoded.uid;
    const email = decoded.email?.toLowerCase();
    if (!email) {
      throw new AppError(400, "La cuenta de Google no tiene email");
    }
    const name = decoded.name?.trim() || email.split("@")[0] || "Usuario";

    let user = await prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { firebaseUid },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email,
            firebaseUid,
            name,
            passwordHash: null,
            phone: "",
          },
        });
      }
    }

    res.json(authPayload(user));
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = z.string().parse(req.body.refreshToken);
    const payload = jwt.verify(token, env.jwtRefreshSecret) as { id: string };
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) throw new AppError(401, "Usuario no encontrado");
    res.json(authPayload(user));
  } catch (err) {
    next(err instanceof AppError ? err : new AppError(401, "Refresh token inválido"));
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: meSelect,
    });
    if (!user) throw new AppError(404, "Usuario no encontrado");
    res.json(toMeJson(user));
  } catch (err) {
    next(err);
  }
});

authRouter.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const body = updateMeSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.paymentAlias !== undefined
          ? { paymentAlias: body.paymentAlias }
          : {}),
        ...(body.paymentCbu !== undefined ? { paymentCbu: body.paymentCbu } : {}),
        ...(body.paymentHolder !== undefined
          ? { paymentHolder: body.paymentHolder }
          : {}),
      },
      select: meSelect,
    });
    res.json(toMeJson(user));
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});
