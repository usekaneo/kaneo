import type { PluginLogger } from "@kaneo/plugin-sdk/server";
import { Cron } from "croner";
import { renewJobLease, withJobLease } from "../../scheduler/leader-lock";
import { renewWhileRunning } from "./renew-while-running";

const LEASE_MS = 15 * 60 * 1000;
const RENEW_EVERY_MS = LEASE_MS / 3;

const jobs = new Map<string, Cron>();

async function renewLease(
  lease: string,
  name: string,
  log: PluginLogger,
): Promise<void> {
  try {
    if (!(await renewJobLease(lease, LEASE_MS))) {
      log.warn(
        `Scheduled job "${name}" lost its lease and may run again on another instance`,
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
  const job = new Cron(pattern, { protect: true }, async () => {
    try {
      await withJobLease(
        lease,
        () =>
          renewWhileRunning(
            async () => {
              await run();
            },
            () => void renewLease(lease, name, log),
            RENEW_EVERY_MS,
          ),
        () => undefined,
        LEASE_MS,
      );
    } catch (error) {
      log.error(`Scheduled job "${name}" failed`, error);
    }
  });
  jobs.set(lease, job);
}

export function stopPluginJobs(): void {
  for (const job of jobs.values()) {
    job.stop();
  }
  jobs.clear();
}
