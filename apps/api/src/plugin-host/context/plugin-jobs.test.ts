import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const leaderLock = vi.hoisted(() => ({
  withJobLease: vi.fn(
    async (_name: string, run: () => Promise<unknown>) => await run(),
  ),
  renewJobLease: vi.fn(async (_name: string, _leaseMs: number) => true),
}));

vi.mock("../../scheduler/leader-lock", () => leaderLock);

import { schedulePluginJob, stopPluginJobs } from "./plugin-jobs";

const MINUTE = 60 * 1000;

function createLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("schedulePluginJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 23, 59, 59));
    leaderLock.withJobLease.mockClear();
    leaderLock.renewJobLease.mockClear();
    leaderLock.renewJobLease.mockResolvedValue(true);
  });

  afterEach(() => {
    stopPluginJobs();
    vi.useRealTimers();
  });

  it("renews the lease every third of the lease while the job runs", async () => {
    let finish = () => {};
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    schedulePluginJob("progress", "sync", "0 0 * * *", run, createLog());

    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(leaderLock.renewJobLease).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(leaderLock.renewJobLease).toHaveBeenCalledTimes(1);
    expect(leaderLock.renewJobLease).toHaveBeenCalledWith(
      "plugin:progress:sync",
      15 * MINUTE,
    );

    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(leaderLock.renewJobLease).toHaveBeenCalledTimes(3);

    finish();
    await vi.advanceTimersByTimeAsync(30 * MINUTE);
    expect(leaderLock.renewJobLease).toHaveBeenCalledTimes(3);
  });

  it("warns when the lease can no longer be renewed", async () => {
    leaderLock.renewJobLease.mockResolvedValue(false);
    const log = createLog();
    let finish = () => {};
    schedulePluginJob(
      "progress",
      "sync",
      "0 0 * * *",
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      log,
    );

    await vi.advanceTimersByTimeAsync(1000 + 5 * MINUTE);
    expect(log.warn).toHaveBeenCalledWith(
      'Scheduled job "sync" lost its lease and may run again on another instance',
    );

    finish();
    await vi.advanceTimersByTimeAsync(0);
  });
});
