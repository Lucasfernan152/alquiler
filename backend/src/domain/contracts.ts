export type IncreaseMethod = "ipc" | "icl" | "fixed" | "other";

export type ContractIncreaseInput = {
  rentAmount: number;
  increaseEveryMonths: number;
  nextIncreaseDate: Date | string | null;
  increaseMethod?: string | null;
  increaseNote?: string | null;
  estimatedIncreasePct?: number | null;
  endDate?: Date | string | null;
};

/** Saca un porcentaje de textos tipo "10%", "10" o "diez por ciento" numérico. */
export function parseIncreasePercent(note?: string | null): number | null {
  if (!note) return null;
  const match = note.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*%?/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0 || value > 500) return null;
  return value;
}

export function resolveIncreasePercent(contract: ContractIncreaseInput): number | null {
  const method = contract.increaseMethod ?? "ipc";

  if (method === "fixed") {
    if (
      contract.estimatedIncreasePct != null &&
      Number.isFinite(contract.estimatedIncreasePct) &&
      contract.estimatedIncreasePct >= 0
    ) {
      return contract.estimatedIncreasePct;
    }
    return parseIncreasePercent(contract.increaseNote);
  }

  if (method === "other") {
    return parseIncreasePercent(contract.increaseNote);
  }

  // ipc / icl: el % viene inyectado desde la API de índices (no del formulario).
  if (
    contract.estimatedIncreasePct != null &&
    Number.isFinite(contract.estimatedIncreasePct) &&
    contract.estimatedIncreasePct >= 0
  ) {
    return contract.estimatedIncreasePct;
  }
  return null;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function utcNoon(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
}

/**
 * Próxima fecha de aumento aún no vencida. Si la guardada ya pasó, avanza de a
 * `increaseEveryMonths` hasta quedar en el futuro.
 */
export function resolveNextIncreaseDate(
  contract: ContractIncreaseInput,
  today = new Date(),
): Date | null {
  const every = contract.increaseEveryMonths;
  if (!every || every < 1) return null;

  let next = asDate(contract.nextIncreaseDate);
  if (!next) return null;
  next = utcNoon(next);
  const now = utcNoon(today);
  const end = asDate(contract.endDate);

  while (next.getTime() <= now.getTime()) {
    next = new Date(next);
    next.setUTCMonth(next.getUTCMonth() + every);
  }

  if (end && next.getTime() > utcNoon(end).getTime()) return null;
  return next;
}

export function estimateNextRent(contract: ContractIncreaseInput): number | null {
  const pct = resolveIncreasePercent(contract);
  if (pct == null) return null;
  if (!Number.isFinite(contract.rentAmount) || contract.rentAmount <= 0) return null;
  return Math.round(contract.rentAmount * (1 + pct / 100));
}

export function formatMoneyArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}
