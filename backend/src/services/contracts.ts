import {
  estimateNextRent,
  formatMoneyArs,
  parseIncreasePercent,
  resolveNextIncreaseDate,
  type ContractIncreaseInput,
} from "../domain/contracts.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.js";
import { applyRentToOpenPeriods } from "./billing.js";
import { estimateIndexIncrease } from "./indices.js";
import { createNotification } from "./notifications.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDayStamp(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export type ContractEstimateFields = {
  estimatedIncreasePct: number | null;
  estimatedRent: number | null;
  estimateProjected: boolean;
  estimateSource: "ipc" | "icl" | "fixed" | "other" | null;
  /** La fecha guardada de aumento ya llegó o pasó. */
  increaseDue: boolean;
};

function asUtcNoon(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  );
}

/** Calcula % y monto estimado (IPC vía API; fijo desde el contrato). */
export async function computeContractEstimate(
  contract: ContractIncreaseInput & { increaseMethod?: string | null },
): Promise<ContractEstimateFields> {
  const method = contract.increaseMethod ?? "ipc";
  const today = asUtcNoon(new Date())!;
  const storedNext = asUtcNoon(contract.nextIncreaseDate);
  const increaseDue = Boolean(
    storedNext && storedNext.getTime() <= today.getTime(),
  );
  // Si el aumento ya venció, estimamos ese período (no el siguiente futuro).
  const next = increaseDue
    ? storedNext
    : resolveNextIncreaseDate(contract);

  const empty = {
    estimatedIncreasePct: null as number | null,
    estimatedRent: null as number | null,
    estimateProjected: false,
    estimateSource: (method === "ipc" || method === "icl" ? method : null) as
      | "ipc"
      | "icl"
      | "fixed"
      | "other"
      | null,
    increaseDue,
  };

  if (method === "fixed") {
    const pct =
      (contract.estimatedIncreasePct != null &&
      Number.isFinite(contract.estimatedIncreasePct)
        ? contract.estimatedIncreasePct
        : null) ?? parseIncreasePercent(contract.increaseNote);
    return {
      ...empty,
      estimatedIncreasePct: pct,
      estimatedRent:
        pct != null && contract.rentAmount > 0
          ? Math.round(contract.rentAmount * (1 + pct / 100))
          : null,
      estimateSource: "fixed",
    };
  }

  if (method === "other") {
    const pct = parseIncreasePercent(contract.increaseNote);
    return {
      ...empty,
      estimatedIncreasePct: pct,
      estimatedRent:
        pct != null && contract.rentAmount > 0
          ? Math.round(contract.rentAmount * (1 + pct / 100))
          : null,
      estimateSource: "other",
    };
  }

  if ((method === "ipc" || method === "icl") && next) {
    try {
      const index = await estimateIndexIncrease({
        method,
        everyMonths: contract.increaseEveryMonths,
        nextIncreaseDate: next,
      });
      if (index) {
        return {
          estimatedIncreasePct: index.pct,
          estimatedRent:
            contract.rentAmount > 0
              ? Math.round(contract.rentAmount * (1 + index.pct / 100))
              : null,
          estimateProjected: index.projected,
          estimateSource: index.source,
          increaseDue,
        };
      }
    } catch (err) {
      console.error("No se pudo estimar el índice de aumento", err);
    }
  }

  return empty;
}

export async function enrichContractWithEstimate<T extends ContractIncreaseInput>(
  contract: T,
): Promise<T & ContractEstimateFields> {
  const estimate = await computeContractEstimate(contract);
  return { ...contract, ...estimate };
}

/**
 * Avisa al dueño 2 meses y 1 mes antes de que termine el contrato activo.
 * Una notificación por contrato y plazo (no se reenvía el mismo día-target).
 */
export async function remindOwnersOfContractEnding(
  monthsBeforeList: number[] = [2, 1],
) {
  const contracts = await prisma.contract.findMany({
    where: { active: true, endDate: { not: null } },
    include: {
      property: { include: { building: true } },
    },
  });

  const today = utcDayStamp(new Date());
  let sent = 0;

  for (const contract of contracts) {
    if (!contract.endDate) continue;
    const endStamp = utcDayStamp(contract.endDate);
    const daysUntil = Math.round((endStamp - today) / MS_PER_DAY);
    if (daysUntil < 0) continue;

    for (const monthsBefore of monthsBeforeList) {
      const target = new Date(contract.endDate);
      target.setUTCMonth(target.getUTCMonth() - monthsBefore);
      const targetStamp = utcDayStamp(target);
      if (today !== targetStamp) continue;

      const ownerId = contract.property.building.ownerId;
      const already = await prisma.notification.findFirst({
        where: {
          userId: ownerId,
          type: "contract_ending_reminder",
          dataJson: { contains: `"reminderKey":"${contract.id}:${monthsBefore}"` },
        },
      });
      if (already) continue;

      const unit = contract.property.label;
      const building = contract.property.building.name;
      const when =
        monthsBefore === 1
          ? "en 1 mes"
          : `en ${monthsBefore} meses`;

      await createNotification({
        userId: ownerId,
        type: "contract_ending_reminder",
        title: `El contrato de ${unit} vence ${when}`,
        body: `${building} · ${unit}: revisá renovación, aumento o fin de contrato antes de que venza.`,
        data: {
          propertyId: contract.propertyId,
          contractId: contract.id,
          monthsBefore,
          reminderKey: `${contract.id}:${monthsBefore}`,
        },
      });
      sent += 1;
    }
  }

  return sent;
}

/**
 * Avisa a dueño e inquilinos 30 y 15 días antes del próximo aumento.
 * A los 15 días incluye el precio estimado actual (IPC actualizado o % fijo).
 */
export async function remindRentIncrease(daysBeforeList: number[] = [30, 15]) {
  const contracts = await prisma.contract.findMany({
    where: { active: true, nextIncreaseDate: { not: null } },
    include: {
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

  for (const contract of contracts) {
    const nextDate = resolveNextIncreaseDate(contract);
    if (!nextDate) continue;

    const daysUntil = Math.round((utcDayStamp(nextDate) - today) / MS_PER_DAY);
    if (!daysBeforeList.includes(daysUntil)) continue;

    const estimate = await computeContractEstimate(contract);
    const estimated = estimate.estimatedRent;
    const unit = contract.property.label;
    const building = contract.property.building.name;
    const when =
      daysUntil === 1
        ? "mañana"
        : daysUntil === 15
          ? "en 15 días"
          : daysUntil === 30
            ? "en 1 mes"
            : `en ${daysUntil} días`;

    const amountText = estimated != null ? formatMoneyArs(estimated) : null;
    const pctText =
      estimate.estimatedIncreasePct != null
        ? ` (+${estimate.estimatedIncreasePct}%)`
        : "";
    const title =
      daysUntil <= 15 && amountText
        ? `El alquiler pasa a ${amountText}`
        : `Próximo aumento ${when}`;
    const body =
      daysUntil <= 15 && amountText
        ? `${building} · ${unit}: el aumento es ${when}. Estimado: ${amountText}${pctText}.`
        : amountText
          ? `${building} · ${unit}: aumento ${when}. Estimado: ${amountText}${pctText}.`
          : `${building} · ${unit}: aumento ${when}. Todavía no hay índice suficiente para estimar el monto.`;

    const recipientIds = [
      contract.property.building.ownerId,
      ...contract.property.tenancies.map((t) => t.tenantId),
    ];

    const reminderKey =
      daysUntil <= 15 && estimated != null
        ? `${contract.id}:${daysUntil}:${estimated}`
        : `${contract.id}:${daysUntil}:${nextDate.toISOString().slice(0, 10)}`;

    for (const userId of recipientIds) {
      const already = await prisma.notification.findFirst({
        where: {
          userId,
          type: "rent_increase_reminder",
          dataJson: { contains: `"reminderKey":"${reminderKey}"` },
        },
      });
      if (already) continue;

      await createNotification({
        userId,
        type: "rent_increase_reminder",
        title,
        body,
        data: {
          propertyId: contract.propertyId,
          contractId: contract.id,
          daysBefore: daysUntil,
          nextIncreaseDate: nextDate.toISOString(),
          estimatedRent: estimated,
          estimatedIncreasePct: estimate.estimatedIncreasePct,
          reminderKey,
        },
      });
      sent += 1;
    }
  }

  return sent;
}

export async function recordRentChange(input: {
  propertyId: string;
  previousAmount: number | null;
  newAmount: number;
  increasePct?: number | null;
  kind: "initial" | "applied" | "manual";
  method?: string | null;
  note?: string;
  effectiveDate: Date;
}) {
  return prisma.rentChange.create({
    data: {
      propertyId: input.propertyId,
      previousAmount: input.previousAmount,
      newAmount: input.newAmount,
      increasePct: input.increasePct ?? null,
      kind: input.kind,
      method: input.method ?? "",
      note: input.note ?? "",
      effectiveDate: input.effectiveDate,
    },
  });
}

/**
 * Aplica el aumento estimado (o un monto que mande el dueño), avanza la próxima
 * fecha, guarda historial y avisa a los inquilinos.
 */
export async function applyRentIncrease(
  propertyId: string,
  ownerId: string,
  opts?: { amount?: number },
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { building: true },
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada");
  if (property.building.ownerId !== ownerId) {
    throw new AppError(403, "No autorizado");
  }

  const current = await prisma.contract.findFirst({
    where: { propertyId, active: true },
    orderBy: { createdAt: "desc" },
  });
  if (!current) throw new AppError(404, "No hay contrato activo");
  if (!current.nextIncreaseDate) {
    throw new AppError(400, "El contrato no tiene fecha de próximo aumento");
  }

  const today = asUtcNoon(new Date())!;
  const dueDate = asUtcNoon(current.nextIncreaseDate)!;
  if (dueDate.getTime() > today.getTime()) {
    throw new AppError(400, "Todavía no llegó la fecha de aumento");
  }

  const estimate = await computeContractEstimate(current);
  const newAmount = opts?.amount ?? estimate.estimatedRent;
  if (newAmount == null || !(newAmount > current.rentAmount)) {
    throw new AppError(
      400,
      "No hay un monto estimado para aplicar. Cargalo a mano o revisá el método de aumento.",
    );
  }

  const increasePct =
    Math.round(((newAmount - current.rentAmount) / current.rentAmount) * 10000) /
    100;

  const nextIncreaseDate = new Date(dueDate);
  nextIncreaseDate.setUTCMonth(
    nextIncreaseDate.getUTCMonth() + current.increaseEveryMonths,
  );

  await prisma.contract.updateMany({
    where: { propertyId, active: true },
    data: { active: false },
  });

  const contract = await prisma.contract.create({
    data: {
      propertyId,
      rentAmount: newAmount,
      currency: current.currency,
      increaseEveryMonths: current.increaseEveryMonths,
      nextIncreaseDate,
      increaseMethod: current.increaseMethod,
      increaseNote: current.increaseNote,
      estimatedIncreasePct:
        current.increaseMethod === "fixed" ? current.estimatedIncreasePct : null,
      requiredInvoiceTypes: current.requiredInvoiceTypes,
      startDate: current.startDate,
      endDate: current.endDate,
      filePath: current.filePath,
      fileName: current.fileName,
      active: true,
    },
  });

  await recordRentChange({
    propertyId,
    previousAmount: current.rentAmount,
    newAmount,
    increasePct,
    kind: "applied",
    method: current.increaseMethod,
    note: estimate.estimateSource
      ? `Aplicado (${estimate.estimateSource}${
          estimate.estimatedIncreasePct != null
            ? ` ${estimate.estimatedIncreasePct}%`
            : ""
        })`
      : "Aumento aplicado",
    effectiveDate: dueDate,
  });

  await applyRentToOpenPeriods(propertyId, newAmount, dueDate);

  const tenants = await prisma.tenancy.findMany({
    where: { propertyId, active: true },
  });
  const from = formatMoneyArs(current.rentAmount);
  const to = formatMoneyArs(newAmount);
  for (const tenancy of tenants) {
    await createNotification({
      userId: tenancy.tenantId,
      type: "rent_increase",
      title: "Aumentó el alquiler",
      body: `El alquiler pasa de ${from} a ${to} (+${increasePct}%).`,
      data: {
        propertyId,
        contractId: contract.id,
        previousRent: current.rentAmount,
        rentAmount: newAmount,
        increasePct,
      },
    });
  }

  return enrichContractWithEstimate(contract);
}

// re-export for callers that imported estimateNextRent from here before
export { estimateNextRent };
