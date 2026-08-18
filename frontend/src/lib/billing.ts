import type { Property, Tenancy } from "../types";

function periodOf(property: Property | null | undefined, periodId?: string) {
  return periodId
    ? property?.billingPeriods?.find((p) => p.id === periodId)
    : property?.billingPeriods?.[0];
}

/**
 * Alquiler del período: el que se congeló ese mes, para que un aumento no
 * cambie lo que ya se cobró. Si el período no lo tiene, el del contrato.
 */
export function rentOf(property: Property | null | undefined, periodId?: string) {
  return (
    periodOf(property, periodId)?.rentAmount ??
    property?.contracts?.[0]?.rentAmount ??
    0
  );
}

export function invoicesSum(
  property: Property | null | undefined,
  periodId?: string,
) {
  return (periodOf(property, periodId)?.invoices ?? []).reduce(
    (sum, i) => sum + i.amount,
    0,
  );
}

/** Alquiler + facturas del período, sin aplicar porcentajes. */
export function periodTotal(
  property: Property | null | undefined,
  periodId?: string,
) {
  return rentOf(property, periodId) + invoicesSum(property, periodId);
}

export function splitsByPercentage(property: Property | null | undefined) {
  return property?.billSplitMode === "split_by_percentage";
}

export type ShareParty = {
  tenancyId: string;
  tenantId: string;
  name: string;
  sharePercentage: number;
};

/** Inquilinos activos con su % de las facturas. */
export function shareParties(property: Property | null | undefined): ShareParty[] {
  return (property?.tenancies ?? [])
    .filter((t) => t.active !== false)
    .map((t: Tenancy) => ({
      tenancyId: t.id,
      tenantId: t.tenantId,
      name: t.tenant?.name?.trim() || t.tenant?.email || "Inquilino",
      sharePercentage: t.sharePercentage,
    }));
}

/**
 * Porcentaje de las facturas que se muestra en la cifra principal.
 * - Inquilino: el suyo.
 * - Dueño con un solo inquilino: el mismo %, para que vean el mismo número.
 * - Dueño con varios: 100 (el desglose va aparte).
 */
export function viewerShare(property: Property | null | undefined) {
  if (!splitsByPercentage(property)) return 100;
  if (property?.role === "tenant") return property?.myShare ?? 100;
  const parties = shareParties(property);
  if (parties.length === 1) return parties[0]!.sharePercentage;
  return 100;
}

/** Aplica el % del inquilino a un monto de factura (alquiler no se divide). */
export function shareOf(amount: number, share: number) {
  if (share === 100) return amount;
  return Math.round(amount * (share / 100) * 100) / 100;
}

/** Alquiler completo + % de facturas para un share dado. */
export function amountDueForShare(
  property: Property | null | undefined,
  share: number,
  periodId?: string,
) {
  return (
    rentOf(property, periodId) + shareOf(invoicesSum(property, periodId), share)
  );
}

/**
 * Lo que tiene que pagar quien está mirando: el alquiler entero más su parte de
 * las facturas. Con un solo inquilino, dueño e inquilino ven la misma cifra.
 */
export function amountDue(
  property: Property | null | undefined,
  periodId?: string,
) {
  return amountDueForShare(property, viewerShare(property), periodId);
}

/** Desglose por inquilino cuando las facturas se dividen. */
export function duesByTenant(
  property: Property | null | undefined,
  periodId?: string,
) {
  if (!splitsByPercentage(property)) return [];
  return shareParties(property).map((party) => ({
    ...party,
    invoicesShare: shareOf(invoicesSum(property, periodId), party.sharePercentage),
    due: amountDueForShare(property, party.sharePercentage, periodId),
  }));
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
