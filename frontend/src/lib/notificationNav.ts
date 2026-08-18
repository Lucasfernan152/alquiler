import type { Notification, Tab } from "../types";

export type NavFocus =
  | { tab: "reclamos"; claimId?: string; propertyId?: string }
  | {
      tab: "facturas";
      propertyId?: string;
      billingPeriodId?: string;
      /** Abre el formulario de comprobante (inquilino). */
      openPayment?: boolean;
    }
  | { tab: "mas"; sheet: "contract"; propertyId?: string };

type NotificationData = {
  claimId?: string;
  propertyId?: string;
  billingPeriodId?: string;
  paymentId?: string;
  contractId?: string;
};

function parseData(item: Notification): NotificationData {
  try {
    const parsed = JSON.parse(item.dataJson || "{}") as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as NotificationData;
  } catch {
    return {};
  }
}

/** Destino al tocar un aviso. */
export function focusFromNotification(item: Notification): NavFocus | null {
  const data = parseData(item);

  switch (item.type) {
    case "claim_created":
    case "claim_updated":
      if (!data.claimId) return { tab: "reclamos", propertyId: data.propertyId };
      return {
        tab: "reclamos",
        claimId: data.claimId,
        propertyId: data.propertyId,
      };

    case "billing_ready":
      return {
        tab: "facturas",
        propertyId: data.propertyId,
        billingPeriodId: data.billingPeriodId,
        openPayment: true,
      };

    case "upload_invoices_reminder":
    case "payment_submitted":
    case "payment_reviewed":
      return {
        tab: "facturas",
        propertyId: data.propertyId,
        billingPeriodId: data.billingPeriodId,
      };

    case "rent_increase":
      return {
        tab: "mas",
        sheet: "contract",
        propertyId: data.propertyId,
      };

    default:
      return null;
  }
}

export function tabFromFocus(focus: NavFocus): Tab {
  return focus.tab;
}
