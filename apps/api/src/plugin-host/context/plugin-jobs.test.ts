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
    async (
      _name: string,
      run: () => Promise<unknown>,
      _skip: () => unknown,
      _options: { leaseMs: number; scheduledAt: Date },
    ) => run(),
  ),
  renewJobLease: vi.fn(
    async (_name: string, _scheduledAt: Date, _leaseMs: number) => true,
  ),
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
    vi.setSystemTime(new Date("2026-01-01T23:59:59Z"));
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
      new Date("2026-01-02T00:00:00Z"),
      15 * MINUTE,
    );

    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(leaderLock.renewJobLease).toHaveBeenCalledTimes(3);

    finish();
    await vi.advanceTimersByTimeAsync(30 * MINUTE);
    expect(leaderLock.renewJobLease).toHaveBeenCalledTimes(3);
  });

  it("claims the originally scheduled instant when the timer fires late", async () => {
    const run = vi.fn();
    schedulePluginJob("progress", "sync", "* * * * *", run, createLog());

    vi.setSystemTime(new Date("2026-01-02T00:07:10Z"));
    await vi.advanceTimersByTimeAsync(1000);

    expect(run).toHaveBeenCalledTimes(1);
    expect(leaderLock.withJobLease.mock.calls[0]?.[3].scheduledAt).toEqual(
      new Date("2026-01-02T00:00:00Z"),
    );

    await vi.advanceTimersByTimeAsync(49_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(leaderLock.withJobLease.mock.calls[1]?.[3].scheduledAt).toEqual(
      new Date("2026-01-02T00:08:00Z"),
    );
  });

  it("skips occurrences while the local callback is still running", async () => {
    let finish = () => {};
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    schedulePluginJob("progress", "sync", "* * * * *", run, createLog());

    await vi.advanceTimersByTimeAsync(2 * MINUTE + 1000);
    expect(run).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(run).toHaveBeenCalledTimes(2);
    finish();
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
      'Scheduled job "sync" lost its lease. A later occurrence may start on another instance.',
    );

    finish();
    await vi.advanceTimersByTimeAsync(0);
  });
});
