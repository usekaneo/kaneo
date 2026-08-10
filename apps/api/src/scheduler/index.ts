import { Cron } from "croner";
import { checkDueDateReminders } from "./due-date-reminders";
import { checkProjectWebhookReminders } from "./project-webhook-reminders";
import { reconcileWorkspaceSeats } from "./seat-reconciliation";

const jobs: Cron[] = [];

export function initializeScheduler(): void {
  jobs.push(new Cron("*/5 * * * *", checkDueDateReminders));
  jobs.push(new Cron("*/5 * * * *", checkProjectWebhookReminders));
  jobs.push(new Cron("17 * * * *", reconcileWorkspaceSeats));
  console.log(
    "⏰ Scheduler started (reminders every 5 minutes, seat reconciliation hourly)",
  );
}

export function shutdownScheduler(): void {
  for (const job of jobs) {
    job.stop();
  }
  jobs.length = 0;
}
