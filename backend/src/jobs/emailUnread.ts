import cron from "node-cron";
import { emailUnreadOlderThan } from "../services/email.js";
import { ensureBillingPeriodsForAll } from "../services/billing.js";

export function startJobs() {
  cron.schedule("0 * * * *", async () => {
    try {
      const count = await emailUnreadOlderThan(24);
      if (count > 0) console.info(`Emails de respaldo enviados: ${count}`);
    } catch (err) {
      console.error("Error en job de emails", err);
    }
  });

  // A medianoche UTC abre el período del mes nuevo si faltaba.
  cron.schedule("5 0 * * *", async () => {
    try {
      const created = await ensureBillingPeriodsForAll();
      if (created > 0) console.info(`Períodos de facturación creados: ${created}`);
    } catch (err) {
      console.error("Error creando períodos", err);
    }
  });
}
