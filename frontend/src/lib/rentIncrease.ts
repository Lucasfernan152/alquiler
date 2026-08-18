import type { Contract } from "../types";

/** Saca un porcentaje de textos tipo "10%" o "10". */
export function parseIncreasePercent(note?: string | null): number | null {
  if (!note) return null;
  const match = note.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*%?/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0 || value > 500) return null;
  return value;
}

export function resolveIncreasePercent(contract: Contract): number | null {
  const method = contract.increaseMethod ?? "ipc";

  if (
    contract.estimatedIncreasePct != null &&
    Number.isFinite(contract.estimatedIncreasePct) &&
    contract.estimatedIncreasePct >= 0
  ) {
    return contract.estimatedIncreasePct;
  }

  if (method === "fixed" || method === "other") {
    return parseIncreasePercent(contract.increaseNote);
  }

  return null;
}

function utcNoon(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
}

/** Próxima fecha de aumento aún vigente (avanza si la guardada ya pasó). */
export function resolveNextIncreaseDate(
  contract: Contract,
  today = new Date(),
): Date | null {
  const every = contract.increaseEveryMonths;
  if (!every || every < 1 || !contract.nextIncreaseDate) return null;

  let next = utcNoon(new Date(contract.nextIncreaseDate));
  if (Number.isNaN(next.getTime())) return null;
  const now = utcNoon(today);
  const end = contract.endDate ? utcNoon(new Date(contract.endDate)) : null;

  while (next.getTime() <= now.getTime()) {
    next = new Date(next);
    next.setUTCMonth(next.getUTCMonth() + every);
  }

  if (end && !Number.isNaN(end.getTime()) && next.getTime() > end.getTime()) {
    return null;
  }
  return next;
}

export function estimateNextRent(contract: Contract): number | null {
  if (contract.estimatedRent != null && Number.isFinite(contract.estimatedRent)) {
    return contract.estimatedRent;
  }
  const pct = resolveIncreasePercent(contract);
  if (pct == null) return null;
  if (!Number.isFinite(contract.rentAmount) || contract.rentAmount <= 0) return null;
  return Math.round(contract.rentAmount * (1 + pct / 100));
}
