import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../lib/env.js";
import { AppError } from "./error.js";

export type AuthUser = { id: string; email: string; name: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(user, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpires as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(user: AuthUser): string {
  return jwt.sign({ id: user.id }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpires as jwt.SignOptions["expiresIn"],
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new AppError(401, "No autenticado"));
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtAccessSecret) as AuthUser;
    req.user = { id: payload.id, email: payload.email, name: payload.name };
    next();
  } catch {
    next(new AppError(401, "Token inválido o expirado"));
  }
}

/**
 * Igual que requireAuth, pero también acepta `?access_token=` para que los
 * links `<a href>` puedan abrir archivos sin mandar el header Authorization.
 */
export function requireAuthAllowQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  const queryToken =
    typeof req.query.access_token === "string" ? req.query.access_token : undefined;
  const raw = header?.startsWith("Bearer ") ? header.slice(7) : queryToken;
  if (!raw) {
    next(new AppError(401, "No autenticado"));
    return;
  }
  try {
    const payload = jwt.verify(raw, env.jwtAccessSecret) as AuthUser;
    req.user = { id: payload.id, email: payload.email, name: payload.name };
    next();
  } catch {
    next(new AppError(401, "Token inválido o expirado"));
  }
}
