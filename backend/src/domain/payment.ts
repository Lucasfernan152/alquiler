export type PaymentFields = {
  paymentAlias: string;
  paymentCbu: string;
  paymentHolder: string;
};

export type ResolvedPaymentDetails = {
  alias: string;
  cbu: string;
  holder: string;
  source: "building" | "owner";
};

function pick(fields: PaymentFields): Omit<ResolvedPaymentDetails, "source"> {
  return {
    alias: fields.paymentAlias.trim(),
    cbu: fields.paymentCbu.trim(),
    holder: fields.paymentHolder.trim(),
  };
}

function hasAny(fields: PaymentFields) {
  return Boolean(
    fields.paymentAlias.trim() ||
      fields.paymentCbu.trim() ||
      fields.paymentHolder.trim(),
  );
}

/**
 * Si el edificio tiene algún dato de cobro, se usa ese set completo.
 * Si no, se usa el del dueño.
 */
export function resolvePaymentDetails(
  building: PaymentFields,
  owner: PaymentFields,
): ResolvedPaymentDetails {
  if (hasAny(building)) {
    return { ...pick(building), source: "building" };
  }
  return { ...pick(owner), source: "owner" };
}
