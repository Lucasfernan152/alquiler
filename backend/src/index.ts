import { createApp } from "./app.js";
import { env } from "./lib/env.js";
import { startJobs } from "./jobs/emailUnread.js";

const app = createApp();

// En Vercel los crons van por HTTP; node-cron solo en proceso local.
if (!env.isServerless) {
  startJobs();
}

app.listen(env.port, () => {
  console.info(`API Alquiler en http://localhost:${env.port}`);
});
