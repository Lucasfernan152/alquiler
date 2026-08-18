/**
 * El resto puede quedar a cargo del dueño o de alguien sin cuenta en la app,
 * así que sólo se rechaza que los inquilinos sumen más del 100%.
 */
export function assertSharePercentages(shares: number[]): void {
  if (shares.length === 0) return;
  const total = shares.reduce((a, b) => a + b, 0);
  if (total - 100 > 0.01) {
    throw new Error("Los porcentajes de los inquilinos suman más de 100%");
  }
}

export function sumInvoiceAmounts(amounts: number[]): number {
  return amounts.reduce((a, b) => a + b, 0);
}

/** Total del período: alquiler del contrato + facturas cargadas. */
export function periodTotal(rentAmount: number, invoiceAmounts: number[]): number {
  return rentAmount + sumInvoiceAmounts(invoiceAmounts);
}

/**
 * El porcentaje divide sólo las facturas: el alquiler lo paga entero el inquilino.
 */
export function amountForTenant(
  rentAmount: number,
  invoicesTotal: number,
  mode: string,
  sharePercentage: number,
): number {
  if (mode !== "split_by_percentage") return rentAmount + invoicesTotal;
  const due = rentAmount + invoicesTotal * (sharePercentage / 100);
  return Math.round(due * 100) / 100;
}

export type RentPoint = {
  newAmount: number;
  effectiveDate: Date;
  createdAt?: Date | null;
};

function monthIndex(year: number, month: number) {
  return year * 12 + (month - 1);
}

/**
 * Alquiler vigente en un mes según el historial: el último cambio cuyo mes de
 * vigencia no sea posterior al del período. Si no hay historial, el del contrato.
 *
 * `knownAt` deja afuera los cambios cargados después de esa fecha, así un
 * aumento con vigencia retroactiva no reescribe un mes que ya se cobró.
 */
export function rentForMonth(
  changes: RentPoint[],
  year: number,
  month: number,
  fallback: number,
  knownAt?: Date | null,
): number {
  const target = monthIndex(year, month);
  const cutoff = knownAt ? new Date(knownAt).getTime() : null;
  let best: RentPoint | null = null;
  for (const change of changes) {
    if (
      cutoff != null &&
      change.createdAt &&
      new Date(change.createdAt).getTime() > cutoff
    ) {
      continue;
    }
    const date = new Date(change.effectiveDate);
    const idx = monthIndex(date.getUTCFullYear(), date.getUTCMonth() + 1);
    if (idx > target) continue;
    if (!best || new Date(best.effectiveDate).getTime() <= date.getTime()) {
      best = change;
    }
  }
  return best?.newAmount ?? fallback;
}

export function parseRequiredInvoiceTypes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeType(value: string) {
  return value.trim().toLowerCase();
}

/** Tipos del preset que todavía no tienen factura cargada en el período. */
export function missingRequiredInvoices(
  required: string[],
  uploadedTypes: string[],
): string[] {
  const have = new Set(uploadedTypes.map(normalizeType));
  return required.filter((type) => !have.has(normalizeType(type)));
}
