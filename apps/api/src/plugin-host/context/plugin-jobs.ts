import type { PluginLogger } from "@kaneo/plugin-sdk/server";
import { Cron } from "croner";
import { renewJobLease, withJobLease } from "../../scheduler/leader-lock";
import { renewWhileRunning } from "./renew-while-running";

const LEASE_MS = 15 * 60 * 1000;
const RENEW_EVERY_MS = LEASE_MS / 3;

const jobs = new Map<string, Cron | null>();

async function renewLease(
  lease: string,
  name: string,
  scheduledAt: Date,
  log: PluginLogger,
): Promise<void> {
  try {
    if (!(await renewJobLease(lease, scheduledAt, LEASE_MS))) {
      log.warn(
        `Scheduled job "${name}" lost its lease. A later occurrence may start on another instance.`,
      );
    }
  } catch (error) {
    log.warn(`Could not renew the lease for scheduled job "${name}"`, error);
  }
}

export function schedulePluginJob(
  pluginId: string,
  name: string,
  pattern: string,
  run: () => void | Promise<void>,
  log: PluginLogger,
): void {
  const lease = `plugin:${pluginId}:${name}`;
  if (jobs.has(lease)) {
    throw new Error(`A job named "${name}" is already scheduled`);
  }

  const schedule = new Cron(pattern, { timezone: "UTC" });
  let running = false;

  async function runOccurrence(scheduledAt: Date) {
    if (running) return;
    running = true;
    try {
      await withJobLease(
        lease,
        () =>
          renewWhileRunning(
            async () => run(),
            () => void renewLease(lease, name, scheduledAt, log),
            RENEW_EVERY_MS,
          ),
        () => undefined,
        { leaseMs: LEASE_MS, scheduledAt },
      );
    } catch (error) {
      log.error(`Scheduled job "${name}" failed`, error);
    } finally {
      running = false;
    }
  }

  function scheduleNext(after: Date) {
    const scheduledAt = schedule.nextRun(after);
    const timer = scheduledAt
      ? new Cron(scheduledAt, { allowPast: true, timezone: "UTC" }, () => {
          // The timer may fire late. Claim the instant it was set for, then
          // skip any missed occurrences before arming the next timer.
          scheduleNext(new Date(Math.max(Date.now(), scheduledAt.getTime())));
          return runOccurrence(scheduledAt);
        })
      : null;
    jobs.set(lease, timer);
  }

  scheduleNext(new Date());
}

export function stopPluginJobs(): void {
  for (const job of jobs.values()) {
    job?.stop();
  }
  jobs.clear();
}
