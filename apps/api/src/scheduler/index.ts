import { Cron } from "croner";
import { checkDueDateReminders } from "./due-date-reminders";
import { checkProjectWebhookReminders } from "./project-webhook-reminders";

const jobs: Cron[] = [];

export function initializeScheduler(): void {
  jobs.push(new Cron("*/5 * * * *", checkDueDateReminders));
  jobs.push(new Cron("*/5 * * * *", checkProjectWebhookReminders));
  console.log("⏰ Scheduler started (due date reminders every 5 minutes)");
}

export function shutdownScheduler(): void {
  for (const job of jobs) {
    job.stop();
  }
  jobs.length = 0;
}
