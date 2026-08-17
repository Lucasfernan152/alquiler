import {
  amountForTenant,
  assertSharePercentages,
  missingRequiredInvoices,
  parseRequiredInvoiceTypes,
  periodTotal,
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

  const missing: Array<{
    propertyId: string;
    year: number;
    month: number;
    label: string;
  }> = [];

  let current = { ...cursor };
  while (ymCompare(current, end) <= 0) {
    if (!have.has(monthKey(current.year, current.month))) {
      missing.push({
        propertyId,
        year: current.year,
        month: current.month,
        label: `${MONTH_NAMES[current.month - 1]} ${current.year}`,
      });
    }
    current = advanceMonth(current.year, current.month);
  }

  if (missing.length === 0) return [];

  await prisma.billingPeriod.createMany({ data: missing });
  return missing;
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

  const rentAmount = contract?.rentAmount ?? 0;
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
    data: { status: "ready", readyAt: new Date() },
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

export async function ensureCanManagePeriod(periodId: string, userId: string) {
  const period = await prisma.billingPeriod.findUnique({
    where: { id: periodId },
    include: { property: { include: { building: true } } },
  });
  if (!period) throw new AppError(404, "Período no encontrado");
  await assertPropertyOwner(period.propertyId, userId);
  return period;
}
