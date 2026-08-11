import { Cron } from "croner";
import { checkDueDateReminders } from "./due-date-reminders";
import { checkProjectWebhookReminders } from "./project-webhook-reminders";
import { reconcileWorkspaceSeats } from "./seat-reconciliation";
import { checkTrialReminders } from "./trial-reminders";

const jobs: Cron[] = [];

export function initializeScheduler(): void {
  jobs.push(new Cron("*/5 * * * *", checkDueDateReminders));
  jobs.push(new Cron("*/5 * * * *", checkProjectWebhookReminders));
  jobs.push(new Cron("17 * * * *", reconcileWorkspaceSeats));
  jobs.push(new Cron("23 * * * *", checkTrialReminders));
  console.log(
    "⏰ Scheduler started (reminders every 5 minutes, seat reconciliation and trial reminders hourly)",
  );
}

export function shutdownScheduler(): void {
  for (const job of jobs) {
    job.stop();
  }
  jobs.length = 0;
}
