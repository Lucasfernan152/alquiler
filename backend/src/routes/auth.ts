import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import {
  requireAuth,
  signAccessToken,
  signRefreshToken,
  type AuthUser,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";

const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v) => v ?? "");

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: phoneSchema,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().trim().max(40).optional(),
});

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new AppError(409, "Ese email ya está registrado");
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        name: body.name,
        phone: body.phone,
      },
    });
    const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
    res.status(201).json({
      user: { ...authUser, phone: user.phone },
      accessToken: signAccessToken(authUser),
      refreshToken: signRefreshToken(authUser),
    });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, err.issues[0]?.message ?? "Datos inválidos") : err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new AppError(401, "Email o contraseña incorrectos");
    }
    const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
    res.json({
      user: { ...authUser, phone: user.phone },
      accessToken: signAccessToken(authUser),
      refreshToken: signRefreshToken(authUser),
    });
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
    const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
    res.json({
      user: { ...authUser, phone: user.phone },
      accessToken: signAccessToken(authUser),
      refreshToken: signRefreshToken(authUser),
    });
  } catch (err) {
    next(err instanceof AppError ? err : new AppError(401, "Refresh token inválido"));
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        buildings: { select: { id: true }, take: 1 },
        tenancies: { where: { active: true }, select: { id: true }, take: 1 },
      },
    });
    if (!user) throw new AppError(404, "Usuario no encontrado");
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      isOwner: user.buildings.length > 0,
      isTenant: user.tenancies.length > 0,
    });
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
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        buildings: { select: { id: true }, take: 1 },
        tenancies: { where: { active: true }, select: { id: true }, take: 1 },
      },
    });
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      isOwner: user.buildings.length > 0,
      isTenant: user.tenancies.length > 0,
    });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});
