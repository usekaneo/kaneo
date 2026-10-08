import type { PluginLogger } from "@kaneo/plugin-sdk/server";
import { Cron } from "croner";
import { withJobLease } from "../../scheduler/leader-lock";

const jobs = new Map<string, Cron>();

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
        async () => {
          await run();
        },
        () => undefined,
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
