import * as Sentry from "@sentry/node";
import { Cron } from "croner";
import { checkDueDateReminders } from "./due-date-reminders";
import { checkProjectWebhookReminders } from "./project-webhook-reminders";
import { reconcileWorkspaceSeats } from "./seat-reconciliation";
import { checkTrialReminders } from "./trial-reminders";

const jobs: Cron[] = [];

function withCheckIn<T>(name: string, fn: () => Promise<T>) {
  return async () => {
    const checkInId = Sentry.captureCheckIn({
      monitorSlug: name,
      status: "in_progress",
    });
    try {
      const result = await fn();
      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: name,
        status: "ok",
      });
      return result;
    } catch (error) {
      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: name,
        status: "error",
      });
      throw error;
    }
  };
}

export function initializeScheduler(): void {
  jobs.push(
    new Cron(
      "*/5 * * * *",
      withCheckIn("due-date-reminders", checkDueDateReminders),
    ),
  );
  jobs.push(
    new Cron(
      "*/5 * * * *",
      withCheckIn("project-webhook-reminders", checkProjectWebhookReminders),
    ),
  );
  jobs.push(
    new Cron(
      "17 * * * *",
      withCheckIn("seat-reconciliation", reconcileWorkspaceSeats),
    ),
  );
  jobs.push(
    new Cron("23 * * * *", withCheckIn("trial-reminders", checkTrialReminders)),
  );
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
