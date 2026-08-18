import { randomBytes } from "node:crypto";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.js";
import { assertPropertyOwner } from "./access.js";
import { createNotification } from "./notifications.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function inviteUrl(token: string) {
  const base = env.appUrl.replace(/\/$/, "");
  return `${base}/?invite=${encodeURIComponent(token)}`;
}

export async function createTenantInvite(
  propertyId: string,
  ownerId: string,
  sharePercentage = 100,
) {
  await assertPropertyOwner(propertyId, ownerId);
  const token = randomBytes(24).toString("base64url");
  const invite = await prisma.tenantInvite.create({
    data: {
      token,
      propertyId,
      sharePercentage,
      createdById: ownerId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
    include: {
      property: {
        select: {
          id: true,
          label: true,
          building: { select: { name: true, address: true } },
        },
      },
    },
  });
  return {
    id: invite.id,
    token: invite.token,
    url: inviteUrl(invite.token),
    sharePercentage: invite.sharePercentage,
    expiresAt: invite.expiresAt,
    property: invite.property,
  };
}

export async function getInvitePreview(token: string) {
  const invite = await prisma.tenantInvite.findUnique({
    where: { token },
    include: {
      property: {
        select: {
          id: true,
          label: true,
          building: {
            select: {
              name: true,
              address: true,
              owner: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!invite) throw new AppError(404, "Invitación no encontrada");
  if (invite.acceptedAt) throw new AppError(410, "Esta invitación ya fue usada");
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new AppError(410, "Esta invitación venció");
  }
  return {
    token: invite.token,
    sharePercentage: invite.sharePercentage,
    expiresAt: invite.expiresAt,
    property: {
      id: invite.property.id,
      label: invite.property.label,
      buildingName: invite.property.building.name,
      address: invite.property.building.address,
      ownerName: invite.property.building.owner.name,
    },
  };
}

export async function acceptTenantInvite(token: string, userId: string) {
  const invite = await prisma.tenantInvite.findUnique({
    where: { token },
    include: {
      property: {
        include: {
          building: { select: { ownerId: true, name: true } },
        },
      },
    },
  });
  if (!invite) throw new AppError(404, "Invitación no encontrada");
  if (invite.acceptedAt) throw new AppError(410, "Esta invitación ya fue usada");
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new AppError(410, "Esta invitación venció");
  }
  if (invite.property.building.ownerId === userId) {
    throw new AppError(400, "No podés aceptar una invitación a tu propio edificio");
  }

  const tenancy = await prisma.tenancy.upsert({
    where: {
      propertyId_tenantId: {
        propertyId: invite.propertyId,
        tenantId: userId,
      },
    },
    create: {
      propertyId: invite.propertyId,
      tenantId: userId,
      sharePercentage: invite.sharePercentage,
      active: true,
    },
    update: {
      sharePercentage: invite.sharePercentage,
      active: true,
      endDate: null,
    },
  });

  await prisma.tenantInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date(), acceptedById: userId },
  });

  const tenant = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  await createNotification({
    userId: invite.property.building.ownerId,
    type: "tenant_joined",
    title: "Nuevo inquilino",
    body: `${tenant?.name ?? tenant?.email ?? "Alguien"} se unió a ${invite.property.building.name} · ${invite.property.label}.`,
    data: {
      propertyId: invite.propertyId,
      tenancyId: tenancy.id,
    },
  });

  return {
    propertyId: invite.propertyId,
    tenancyId: tenancy.id,
  };
}
