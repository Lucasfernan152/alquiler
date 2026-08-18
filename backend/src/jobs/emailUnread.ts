import cron from "node-cron";
import {
  ensureBillingPeriodsForAll,
  remindOwnersToUploadInvoices,
  remindTenantsToPay,
} from "../services/billing.js";
import { remindOwnersOfContractEnding, remindRentIncrease } from "../services/contracts.js";
import { emailUnreadOlderThan } from "../services/email.js";

export function startJobs() {
  cron.schedule("0 * * * *", async () => {
    try {
      const count = await emailUnreadOlderThan(24);
      if (count > 0) console.info(`Emails de respaldo enviados: ${count}`);
    } catch (err) {
      console.error("Error en job de emails", err);
    }
  });

  // A medianoche UTC: períodos nuevos + recordatorios.
  cron.schedule("5 0 * * *", async () => {
    try {
      const created = await ensureBillingPeriodsForAll();
      if (created > 0) console.info(`Períodos de facturación creados: ${created}`);
      const reminders = await remindOwnersToUploadInvoices(10);
      if (reminders > 0) {
        console.info(`Recordatorios de facturas al dueño: ${reminders}`);
      }
      const ending = await remindOwnersOfContractEnding([2, 1]);
      if (ending > 0) {
        console.info(`Recordatorios de fin de contrato: ${ending}`);
      }
      const increases = await remindRentIncrease([30, 15]);
      if (increases > 0) {
        console.info(`Recordatorios de aumento: ${increases}`);
      }
      const payReminders = await remindTenantsToPay([3, 7]);
      if (payReminders > 0) {
        console.info(`Recordatorios de pago al inquilino: ${payReminders}`);
      }
    } catch (err) {
      console.error("Error en job diario de facturación", err);
    }
  });
}
