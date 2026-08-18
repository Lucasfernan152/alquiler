import cron from "node-cron";
import { emailUnreadOlderThan } from "../services/email.js";
import {
  ensureBillingPeriodsForAll,
  remindOwnersToUploadInvoices,
} from "../services/billing.js";

export function startJobs() {
  cron.schedule("0 * * * *", async () => {
    try {
      const count = await emailUnreadOlderThan(24);
      if (count > 0) console.info(`Emails de respaldo enviados: ${count}`);
    } catch (err) {
      console.error("Error en job de emails", err);
    }
  });

  // A medianoche UTC: períodos nuevos + recordatorio al dueño (~10 días antes).
  cron.schedule("5 0 * * *", async () => {
    try {
      const created = await ensureBillingPeriodsForAll();
      if (created > 0) console.info(`Períodos de facturación creados: ${created}`);
      const reminders = await remindOwnersToUploadInvoices(10);
      if (reminders > 0) {
        console.info(`Recordatorios de facturas al dueño: ${reminders}`);
      }
    } catch (err) {
      console.error("Error en job diario de facturación", err);
    }
  });
}
