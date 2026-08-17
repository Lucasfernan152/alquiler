import type { Property } from "../types";

export function rentOf(property: Property | null | undefined) {
  return property?.contracts?.[0]?.rentAmount ?? 0;
}

export function invoicesSum(
  property: Property | null | undefined,
  periodId?: string,
) {
  const period = periodId
    ? property?.billingPeriods?.find((p) => p.id === periodId)
    : property?.billingPeriods?.[0];
  return (period?.invoices ?? []).reduce((sum, i) => sum + i.amount, 0);
}

/** Alquiler + facturas del período, sin aplicar porcentajes. */
export function periodTotal(
  property: Property | null | undefined,
  periodId?: string,
) {
  return rentOf(property) + invoicesSum(property, periodId);
}

export function splitsByPercentage(property: Property | null | undefined) {
  return property?.billSplitMode === "split_by_percentage";
}

/**
 * Porcentaje de las facturas que se muestra. El inquilino ve su parte; el dueño
 * ve exactamente la misma cifra que su inquilino cuando hay uno solo, así los
 * números coinciden entre ambas vistas.
 */
export function viewerShare(property: Property | null | undefined) {
  if (!splitsByPercentage(property)) return 100;
  if (property?.role === "tenant") return property?.myShare ?? 100;
  const tenancies = property?.tenancies ?? [];
  if (tenancies.length === 1) return tenancies[0]!.sharePercentage;
  return 100;
}

/** Aplica el % del inquilino a un monto de factura (alquiler no se divide). */
export function shareOf(amount: number, share: number) {
  if (share === 100) return amount;
  return Math.round(amount * (share / 100) * 100) / 100;
}

/**
 * Lo que tiene que pagar quien está mirando: el alquiler entero más su parte de
 * las facturas. El dueño ve el total completo.
 */
export function amountDue(
  property: Property | null | undefined,
  periodId?: string,
) {
  const share = viewerShare(property);
  const rent = rentOf(property);
  const invoices = invoicesSum(property, periodId);
  return rent + shareOf(invoices, share);
}

export function requiredInvoiceTypes(
  property: Property | null | undefined,
): string[] {
  const raw = property?.contracts?.[0]?.requiredInvoiceTypes;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((v) => v.trim()).filter(Boolean);
  }
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

export function missingRequiredInvoiceTypes(
  property: Property | null | undefined,
  periodId?: string,
): string[] {
  const required = requiredInvoiceTypes(property);
  const period = periodId
    ? property?.billingPeriods?.find((p) => p.id === periodId)
    : property?.billingPeriods?.[0];
  const have = new Set(
    (period?.invoices ?? []).map((i) => i.type.trim().toLowerCase()),
  );
  return required.filter((type) => !have.has(type.trim().toLowerCase()));
}
