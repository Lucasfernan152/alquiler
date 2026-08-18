import {
  amountForTenant,
  assertSharePercentages,
  missingRequiredInvoices,
  parseRequiredInvoiceTypes,
  periodTotal,
  rentForMonth,
  sumInvoiceAmounts,
} from "../domain/billing.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.js";
import { assertPropertyOwner } from "./access.js";
import { createNotification } from "./notifications.js";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}

function advanceMonth(year: number, month: number) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function ymCompare(
  a: { year: number; month: number },
  b: { year: number; month: number },
) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

/**
 * Crea los períodos mensuales faltantes desde el inicio del contrato
 * hasta el mes actual (o hasta el fin del contrato).
 */
export async function ensureBillingPeriods(propertyId: string) {
  const contract = await prisma.contract.findFirst({
    where: { propertyId, active: true },
    orderBy: { createdAt: "desc" },
  });
  if (!contract) return [];

  await backfillPeriodRentAmounts(propertyId, contract.rentAmount);

  const start = new Date(contract.startDate);
  const cursor = {
    year: start.getUTCFullYear(),
    month: start.getUTCMonth() + 1,
  };

  const now = new Date();
  let end = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };

  if (contract.endDate) {
    const contractEnd = new Date(contract.endDate);
    const capped = {
      year: contractEnd.getUTCFullYear(),
      month: contractEnd.getUTCMonth() + 1,
    };
    if (ymCompare(capped, end) < 0) end = capped;
  }

  if (ymCompare(cursor, end) > 0) return [];

  const existing = await prisma.billingPeriod.findMany({
    where: { propertyId },
    select: { year: true, month: true },
  });
  const have = new Set(existing.map((p) => monthKey(p.year, p.month)));

  const changes = await prisma.rentChange.findMany({
    where: { propertyId },
    select: { newAmount: true, effectiveDate: true },
  });

  const missing: Array<{
    propertyId: string;
    year: number;
    month: number;
    label: string;
    rentAmount: number;
  }> = [];

  let current = { ...cursor };
  while (ymCompare(current, end) <= 0) {
    if (!have.has(monthKey(current.year, current.month))) {
      missing.push({
        propertyId,
        year: current.year,
        month: current.month,
        label: `${MONTH_NAMES[current.month - 1]} ${current.year}`,
        rentAmount: rentForMonth(
          changes,
          current.year,
          current.month,
          contract.rentAmount,
        ),
      });
    }
    current = advanceMonth(current.year, current.month);
  }

  if (missing.length === 0) return [];

  await prisma.billingPeriod.createMany({ data: missing });
  return missing;
}

/** Completa el alquiler de períodos viejos guardados antes del snapshot. */
async function backfillPeriodRentAmounts(propertyId: string, fallback: number) {
  const pending = await prisma.billingPeriod.findMany({
    where: { propertyId, rentAmount: null },
    select: { id: true, year: true, month: true, readyAt: true },
  });
  if (pending.length === 0) return;

  const history = await prisma.rentChange.findMany({
    where: { propertyId },
    select: {
      newAmount: true,
      effectiveDate: true,
      createdAt: true,
      kind: true,
    },
  });
  // El monto inicial vale para todo el contrato aunque se haya registrado tarde.
  const changes = history.map((change) => ({
    ...change,
    createdAt: change.kind === "initial" ? null : change.createdAt,
  }));

  for (const period of pending) {
    await prisma.billingPeriod.update({
      where: { id: period.id },
      data: {
        rentAmount: rentForMonth(
          changes,
          period.year,
          period.month,
          fallback,
          period.readyAt,
        ),
      },
    });
  }
}

/**
 * Lleva un alquiler nuevo a los períodos que todavía se están armando desde el
 * mes en que rige. Los ya avisados o liquidados conservan el monto que se cobró.
 */
export async function applyRentToOpenPeriods(
  propertyId: string,
  rentAmount: number,
  effectiveDate: Date,
) {
  const year = effectiveDate.getUTCFullYear();
  const month = effectiveDate.getUTCMonth() + 1;
  await prisma.billingPeriod.updateMany({
    where: {
      propertyId,
      status: "collecting",
      OR: [{ year: { gt: year } }, { year, month: { gte: month } }],
    },
    data: { rentAmount },
  });
}

export async function ensureBillingPeriodsForAll() {
  const contracts = await prisma.contract.findMany({
    where: { active: true },
    select: { propertyId: true },
    distinct: ["propertyId"],
  });
  let created = 0;
  for (const { propertyId } of contracts) {
    const missing = await ensureBillingPeriods(propertyId);
    created += missing.length;
  }
  return created;
}

export async function markPeriodReady(periodId: string, ownerId: string) {
  const period = await prisma.billingPeriod.findUnique({
    where: { id: periodId },
    include: {
      invoices: true,
      property: {
        include: {
          building: true,
          tenancies: { where: { active: true }, include: { tenant: true } },
          contracts: { where: { active: true }, take: 1 },
        },
      },
    },
  });
  if (!period) throw new AppError(404, "Período no encontrado");
  if (period.property.building.ownerId !== ownerId) {
    throw new AppError(403, "No autorizado");
  }
  if (period.status === "ready" || period.status === "settled") {
    throw new AppError(400, "El período ya está listo o liquidado");
  }

  const contract = period.property.contracts[0];
  const required = parseRequiredInvoiceTypes(contract?.requiredInvoiceTypes);
  const missing = missingRequiredInvoices(
    required,
    period.invoices.map((i) => i.type),
  );
  if (missing.length > 0) {
    throw new AppError(
      400,
      `Faltan facturas del preset: ${missing.join(", ")}. Subilas antes de avisar al inquilino.`,
    );
  }
  if (required.length === 0 && period.invoices.length === 0) {
    throw new AppError(
      400,
      "Subí al menos una factura o definí un preset en el contrato",
    );
  }

  const rentAmount = period.rentAmount ?? contract?.rentAmount ?? 0;
  const invoicesTotal = sumInvoiceAmounts(period.invoices.map((i) => i.amount));
  const total = periodTotal(
    rentAmount,
    period.invoices.map((i) => i.amount),
  );
  const mode = period.property.billSplitMode;
  const tenants = period.property.tenancies;
  if (mode === "split_by_percentage") {
    try {
      assertSharePercentages(tenants.map((t) => t.sharePercentage));
    } catch (err) {
      throw new AppError(400, (err as Error).message);
    }
  }

  const updated = await prisma.billingPeriod.update({
    where: { id: periodId },
    data: { status: "ready", readyAt: new Date(), rentAmount },
    include: { invoices: true },
  });

  for (const tenancy of tenants) {
    const due = amountForTenant(
      rentAmount,
      invoicesTotal,
      mode,
      tenancy.sharePercentage,
    );
    const share =
      mode === "split_by_percentage" ? tenancy.sharePercentage : 100;
    const detailLines = [
      ...(rentAmount > 0 ? [`• Alquiler: $${rentAmount.toFixed(2)}`] : []),
      ...period.invoices.map((i) => {
        const line =
          share === 100
            ? i.amount
            : Math.round(i.amount * (share / 100) * 100) / 100;
        const suffix = share === 100 ? "" : ` (tu ${share}%)`;
        return `• ${i.type}: $${line.toFixed(2)}${suffix}`;
      }),
    ].join("\n");
    const body = `Monto a pagar: $${due.toFixed(2)}\n\nDetalle:\n${detailLines}`;
    await createNotification({
      userId: tenancy.tenantId,
      type: "billing_ready",
      title: `Facturas listas — ${period.label}`,
      body,
      data: {
        billingPeriodId: period.id,
        propertyId: period.propertyId,
        amount: due,
        rentAmount,
      },
    });
  }

  return { period: updated, total };
}

/**
 * Si el período ya tiene todas las facturas del preset (o al menos una si no
 * hay preset), marca listo y avisa a los inquilinos. No hace nada si falta algo.
 */
export async function maybeAutoMarkPeriodReady(periodId: string, ownerId: string) {
  const period = await prisma.billingPeriod.findUnique({
    where: { id: periodId },
    include: {
      invoices: true,
      property: {
        include: {
          building: true,
          contracts: { where: { active: true }, take: 1 },
        },
      },
    },
  });
  if (!period) return null;
  if (period.status !== "collecting") return null;
  if (period.property.building.ownerId !== ownerId) return null;

  const required = parseRequiredInvoiceTypes(
    period.property.contracts[0]?.requiredInvoiceTypes,
  );
  const missing = missingRequiredInvoices(
    required,
    period.invoices.map((i) => i.type),
  );
  if (missing.length > 0) return null;
  if (required.length === 0 && period.invoices.length === 0) return null;

  return markPeriodReady(periodId, ownerId);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** El inquilino debería pagar el 1° del mes siguiente al período. */
export function paymentDueDate(year: number, month: number) {
  // month 1–12; Date.UTC usa 0–11, así `month` cae en el 1° del mes siguiente.
  return new Date(Date.UTC(year, month, 1, 12));
}

function utcDayStamp(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Avisa al dueño ~10 días antes de que el inquilino deba pagar, si todavía
 * faltan facturas. Una sola vez por período.
 */
export async function remindOwnersToUploadInvoices(daysBefore = 10) {
  const periods = await prisma.billingPeriod.findMany({
    where: { status: "collecting" },
    include: {
      invoices: { select: { type: true } },
      property: {
        include: {
          building: true,
          contracts: { where: { active: true }, take: 1 },
        },
      },
    },
  });

  const today = utcDayStamp(new Date());
  let sent = 0;

  for (const period of periods) {
    const due = paymentDueDate(period.year, period.month);
    const daysUntil = Math.round((utcDayStamp(due) - today) / MS_PER_DAY);
    if (daysUntil !== daysBefore) continue;

    const required = parseRequiredInvoiceTypes(
      period.property.contracts[0]?.requiredInvoiceTypes,
    );
    const missing = missingRequiredInvoices(
      required,
      period.invoices.map((i) => i.type),
    );
    const needsUpload =
      missing.length > 0 || (required.length === 0 && period.invoices.length === 0);
    if (!needsUpload) continue;

    const ownerId = period.property.building.ownerId;
    const already = await prisma.notification.findFirst({
      where: {
        userId: ownerId,
        type: "upload_invoices_reminder",
        dataJson: { contains: period.id },
      },
    });
    if (already) continue;

    const unit = period.property.label;
    const building = period.property.building.name;
    const missingText =
      missing.length > 0
        ? `Faltan: ${missing.join(", ")}.`
        : "Todavía no cargaste ninguna factura.";

    await createNotification({
      userId: ownerId,
      type: "upload_invoices_reminder",
      title: `Subí las facturas de ${period.label}`,
      body: `${building} · ${unit}: el inquilino debería pagar en ~${daysBefore} días. ${missingText}`,
      data: {
        billingPeriodId: period.id,
        propertyId: period.propertyId,
      },
    });
    sent += 1;
  }

  return sent;
}

/**
 * Avisa al inquilino si el período está listo, ya pasó el vencimiento y todavía
 * no subió comprobante (ni pendiente ni aprobado). Por defecto a los 3 y 7 días.
 */
export async function remindTenantsToPay(daysAfterDueList: number[] = [3, 7]) {
  const periods = await prisma.billingPeriod.findMany({
    where: { status: "ready" },
    include: {
      payments: { select: { tenantId: true, status: true } },
      property: {
        include: {
          building: true,
          tenancies: { where: { active: true } },
        },
      },
    },
  });

  const today = utcDayStamp(new Date());
  let sent = 0;

  for (const period of periods) {
    const due = paymentDueDate(period.year, period.month);
    const daysAfter = Math.round((today - utcDayStamp(due)) / MS_PER_DAY);
    if (!daysAfterDueList.includes(daysAfter)) continue;

    const unit = period.property.label;
    const building = period.property.building.name;

    for (const tenancy of period.property.tenancies) {
      const alreadyPaid = period.payments.some(
        (p) =>
          p.tenantId === tenancy.tenantId &&
          (p.status === "pending" || p.status === "approved"),
      );
      if (alreadyPaid) continue;

      const reminderKey = `${period.id}:${tenancy.tenantId}:${daysAfter}`;
      const already = await prisma.notification.findFirst({
        where: {
          userId: tenancy.tenantId,
          type: "payment_due_reminder",
          dataJson: { contains: `"reminderKey":"${reminderKey}"` },
        },
      });
      if (already) continue;

      await createNotification({
        userId: tenancy.tenantId,
        type: "payment_due_reminder",
        title: `Falta el pago de ${period.label}`,
        body: `${building} · ${unit}: el vencimiento fue hace ${daysAfter} día${
          daysAfter === 1 ? "" : "s"
        }. Subí el comprobante cuando puedas.`,
        data: {
          billingPeriodId: period.id,
          propertyId: period.propertyId,
          daysAfterDue: daysAfter,
          reminderKey,
        },
      });
      sent += 1;
    }
  }

  return sent;
}

export async function ensureCanManagePeriod(periodId: string, userId: string) {
  const period = await prisma.billingPeriod.findUnique({
    where: { id: periodId },
    include: { property: { include: { building: true } } },
  });
  if (!period) throw new AppError(404, "Período no encontrado");
  await assertPropertyOwner(period.propertyId, userId);
  return period;
}
