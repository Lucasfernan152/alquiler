import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { assertBuildingOwner, assertPropertyOwner } from "../services/access.js";
import { ensureBillingPeriods } from "../services/billing.js";
import { enrichContractWithEstimate } from "../services/contracts.js";
import { resolvePaymentDetails } from "../domain/payment.js";
import { mountPropertyInviteRoute } from "./invites.js";

const ownerPaymentSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  paymentAlias: true,
  paymentCbu: true,
  paymentHolder: true,
} as const;

export const buildingsRouter = Router();
buildingsRouter.use(requireAuth);

buildingsRouter.get("/", async (req, res, next) => {
  try {
    const buildings = await prisma.building.findMany({
      where: { ownerId: req.user!.id },
      include: {
        properties: {
          include: {
            tenancies: {
              where: { active: true },
              include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json(buildings);
  } catch (err) {
    next(err);
  }
});

buildingsRouter.post("/", async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1),
        address: z.string().min(1),
        city: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);
    const building = await prisma.building.create({
      data: {
        ownerId: req.user!.id,
        name: body.name,
        address: body.address,
        city: body.city ?? "",
        notes: body.notes ?? "",
      },
    });
    res.status(201).json(building);
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});

buildingsRouter.patch("/:id", async (req, res, next) => {
  try {
    await assertBuildingOwner(req.params.id!, req.user!.id);
    const body = z
      .object({
        name: z.string().min(1).optional(),
        address: z.string().min(1).optional(),
        city: z.string().optional(),
        notes: z.string().optional(),
        paymentAlias: z.string().trim().max(80).optional(),
        paymentCbu: z.string().trim().max(40).optional(),
        paymentHolder: z.string().trim().max(120).optional(),
      })
      .parse(req.body);
    const building = await prisma.building.update({
      where: { id: req.params.id },
      data: body,
    });
    res.json(building);
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});

buildingsRouter.delete("/:id", async (req, res, next) => {
  try {
    await assertBuildingOwner(req.params.id!, req.user!.id);
    await prisma.building.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

buildingsRouter.post("/:id/properties", async (req, res, next) => {
  try {
    await assertBuildingOwner(req.params.id!, req.user!.id);
    const body = z
      .object({
        label: z.string().min(1),
        floor: z.string().optional(),
        notes: z.string().optional(),
        billSplitMode: z.enum(["tenant_pays_all", "split_by_percentage"]).optional(),
      })
      .parse(req.body);
    const property = await prisma.property.create({
      data: {
        buildingId: req.params.id!,
        label: body.label,
        floor: body.floor ?? "",
        notes: body.notes ?? "",
        billSplitMode: body.billSplitMode ?? "tenant_pays_all",
      },
    });
    res.status(201).json(property);
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});

export const propertiesRouter = Router();
propertiesRouter.use(requireAuth);

propertiesRouter.get("/mine/tenant", async (req, res, next) => {
  try {
    const tenancies = await prisma.tenancy.findMany({
      where: { tenantId: req.user!.id, active: true },
      include: {
        property: {
          include: {
            building: true,
            emergencyContacts: true,
            contracts: { where: { active: true }, take: 1 },
          },
        },
      },
    });
    res.json(tenancies);
  } catch (err) {
    next(err);
  }
});

propertiesRouter.get("/:id", async (req, res, next) => {
  try {
    const propertyId = req.params.id!;
    await ensureBillingPeriods(propertyId);

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        building: {
          include: {
            owner: { select: ownerPaymentSelect },
          },
        },
        tenancies: {
          where: { active: true },
          include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
        },
        contracts: { where: { active: true }, orderBy: { createdAt: "desc" } },
        rentChanges: { orderBy: { effectiveDate: "desc" }, take: 24 },
        emergencyContacts: true,
        billingPeriods: {
          orderBy: [{ year: "desc" }, { month: "desc" }],
          take: 24,
          include: {
            invoices: true,
            payments: {
              include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
            },
          },
        },
        claims: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { author: { select: { id: true, name: true, email: true, phone: true } } },
        },
      },
    });
    if (!property) throw new AppError(404, "Propiedad no encontrada");
    const isOwner = property.building.ownerId === req.user!.id;
    const myTenancy = property.tenancies.find((t) => t.tenantId === req.user!.id);
    if (!isOwner && !myTenancy) throw new AppError(403, "No autorizado");

    const contracts = await Promise.all(
      property.contracts.map((c) => enrichContractWithEstimate(c)),
    );

    res.json({
      ...property,
      contracts,
      role: isOwner ? "owner" : "tenant",
      myShare: myTenancy?.sharePercentage ?? 100,
      paymentDetails: resolvePaymentDetails(property.building, property.building.owner),
    });
  } catch (err) {
    next(err);
  }
});

propertiesRouter.patch("/:id", async (req, res, next) => {
  try {
    await assertPropertyOwner(req.params.id!, req.user!.id);
    const body = z
      .object({
        label: z.string().min(1).optional(),
        floor: z.string().optional(),
        notes: z.string().optional(),
        billSplitMode: z.enum(["tenant_pays_all", "split_by_percentage"]).optional(),
      })
      .parse(req.body);
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: body,
    });
    res.json(property);
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});

propertiesRouter.post("/:id/tenants", async (req, res, next) => {
  try {
    await assertPropertyOwner(req.params.id!, req.user!.id);
    const body = z
      .object({
        email: z.string().email(),
        sharePercentage: z.number().min(0).max(100).optional(),
      })
      .parse(req.body);
    const tenant = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (!tenant) throw new AppError(404, "No hay usuario con ese email. Que se registre primero.");
    const tenancy = await prisma.tenancy.upsert({
      where: {
        propertyId_tenantId: {
          propertyId: req.params.id!,
          tenantId: tenant.id,
        },
      },
      create: {
        propertyId: req.params.id!,
        tenantId: tenant.id,
        sharePercentage: body.sharePercentage ?? 100,
        active: true,
      },
      update: {
        sharePercentage: body.sharePercentage ?? 100,
        active: true,
        endDate: null,
      },
      include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
    });
    res.status(201).json(tenancy);
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});

propertiesRouter.delete("/:id/tenants/:tenancyId", async (req, res, next) => {
  try {
    await assertPropertyOwner(req.params.id!, req.user!.id);
    await prisma.tenancy.update({
      where: { id: req.params.tenancyId },
      data: { active: false, endDate: new Date() },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

mountPropertyInviteRoute(propertiesRouter);

propertiesRouter.post("/:id/emergency-contacts", async (req, res, next) => {
  try {
    await assertPropertyOwner(req.params.id!, req.user!.id);
    const body = z
      .object({
        category: z.string().min(1),
        name: z.string().min(1),
        phone: z.string().min(1),
        notes: z.string().optional(),
      })
      .parse(req.body);
    const contact = await prisma.emergencyContact.create({
      data: {
        propertyId: req.params.id!,
        category: body.category,
        name: body.name,
        phone: body.phone,
        notes: body.notes ?? "",
      },
    });
    res.status(201).json(contact);
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, "Datos inválidos") : err);
  }
});

propertiesRouter.delete("/:id/emergency-contacts/:contactId", async (req, res, next) => {
  try {
    await assertPropertyOwner(req.params.id!, req.user!.id);
    await prisma.emergencyContact.delete({ where: { id: req.params.contactId } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
