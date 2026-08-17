import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.js";

export async function assertBuildingOwner(buildingId: string, userId: string) {
  const building = await prisma.building.findUnique({ where: { id: buildingId } });
  if (!building) throw new AppError(404, "Edificio no encontrado");
  if (building.ownerId !== userId) throw new AppError(403, "No autorizado");
  return building;
}

export async function assertPropertyOwner(propertyId: string, userId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { building: true },
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada");
  if (property.building.ownerId !== userId) throw new AppError(403, "No autorizado");
  return property;
}

export async function assertPropertyTenantOrOwner(propertyId: string, userId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      building: true,
      tenancies: { where: { tenantId: userId, active: true } },
    },
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada");
  const isOwner = property.building.ownerId === userId;
  const isTenant = property.tenancies.length > 0;
  if (!isOwner && !isTenant) throw new AppError(403, "No autorizado");
  return { property, isOwner, isTenant };
}
