// A run can start several jobs; the newest one speaks for the run.
export function getLatestCodeJob<T extends { createdAt: string }>(
  jobs: readonly T[],
): T | undefined {
  return jobs.reduce<T | undefined>(
    (latest, job) =>
      !latest || job.createdAt > latest.createdAt ? job : latest,
    undefined,
  );
}
