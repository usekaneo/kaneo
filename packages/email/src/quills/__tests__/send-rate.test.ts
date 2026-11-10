import { describe, it, expect } from "vite-plus/test";
import { createSendRateLimiter, SendRateQueueFullError } from "../send-rate";
import type { SendRateClock } from "../send-rate";

/**
 * A clock that only moves when the test says so.
 *
 * `sleep` parks the caller on a timer that `runAll` releases in due-time order,
 * advancing `now` to each one as it fires, so every assertion below reads the
 * time a send was actually let through rather than the time it was asked for.
 */
function fakeClock(): SendRateClock & {
  runAll(): Promise<void>;
  pending(): number;
} {
  let now = 0;
  const timers: Array<{ at: number; seq: number; resolve: () => void }> = [];
  let seq = 0;
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  return {
    now: () => now,
    sleep: (ms) =>
      new Promise<void>((resolve) => {
        timers.push({ at: now + ms, seq: seq++, resolve });
      }),
    pending: () => timers.length,
    async runAll() {
      await flush();
      while (timers.length > 0) {
        timers.sort((a, b) => a.at - b.at || a.seq - b.seq);
        const next = timers.shift()!;
        now = Math.max(now, next.at);
        next.resolve();
        await flush();
      }
    },
  };
}

/** Fire `count` acquires at once and record when, and in what order, each got through. */
async function burst(rate: number, count: number, maxWaitMs?: number) {
  const clock = fakeClock();
  const limiter = createSendRateLimiter(rate, {
    clock,
    ...(maxWaitMs ? { maxWaitMs } : {}),
  });
  const released: Array<{ index: number; at: number }> = [];
  const all = Promise.all(
    Array.from({ length: count }, (_, index) =>
      limiter.acquire().then(() => released.push({ index, at: clock.now() })),
    ),
  );
  await clock.runAll();
  await all;
  return released;
}

describe("createSendRateLimiter", () => {
  it("lets a burst through no faster than the configured rate", async () => {
    const rate = 10;
    const released = await burst(rate, 35);

    // Every send got through: waiting is a delay, never a drop.
    expect(released).toHaveLength(35);
    // Spaced one interval apart from the first, so no one-second window holds
    // more than `rate` of them.
    released.forEach(({ at }, i) =>
      expect(at).toBeGreaterThanOrEqual(i * (1000 / rate)),
    );
    for (const { at: start } of released) {
      const inWindow = released.filter(
        ({ at }) => at >= start && at < start + 1000,
      );
      expect(inWindow.length).toBeLessThanOrEqual(rate);
    }
    // The whole burst took as long as the rate says it must.
    expect(released.at(-1)!.at).toBeGreaterThanOrEqual(
      ((35 - 1) * 1000) / rate,
    );
  });

  it("releases sends in the order they asked", async () => {
    const released = await burst(5, 20);
    expect(released.map((r) => r.index)).toEqual(
      Array.from({ length: 20 }, (_, i) => i),
    );
  });

  it("does not hold back a send that arrives after the line has cleared", async () => {
    const clock = fakeClock();
    const limiter = createSendRateLimiter(10, { clock });
    await limiter.acquire();
    expect(clock.pending()).toBe(0);
    // A later caller, well after the first slot: no wait.
    const later = clock.sleep(500);
    await clock.runAll();
    await later;
    const arrivedAt = clock.now();
    await limiter.acquire();
    expect(clock.pending()).toBe(0);
    expect(clock.now()).toBe(arrivedAt);
  });

  it("refuses rather than queues a send whose wait would pass the cap", async () => {
    const clock = fakeClock();
    // 10/s with a one-second cap holds the first send plus ten more.
    const limiter = createSendRateLimiter(10, { clock, maxWaitMs: 1000 });
    const settled = Promise.allSettled(
      Array.from({ length: 5_000 }, () => limiter.acquire()),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    // Only the admitted sends hold a timer (the first needed none); the rest
    // were turned away at once, so a 5,000-send burst parks ten timers, not 5,000.
    expect(clock.pending()).toBe(10);
    await clock.runAll();
    const results = await settled;
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(11);
    const refused = results.filter((r) => r.status === "rejected");
    expect(refused).toHaveLength(4_989);
    for (const r of refused) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(
        SendRateQueueFullError,
      );
    }
  });

  it("reports a refused send as a SendRateQueueFullError and spends no slot on it", async () => {
    const clock = fakeClock();
    const limiter = createSendRateLimiter(10, { clock, maxWaitMs: 250 });
    // Waits of 0, 100 and 200ms are inside the cap; the fourth would be 300ms.
    const admitted = [limiter.acquire(), limiter.acquire(), limiter.acquire()];
    const refused = limiter.acquire();
    await expect(refused).rejects.toBeInstanceOf(SendRateQueueFullError);
    await clock.runAll();
    await Promise.all(admitted);
    // The refusal reserved nothing: once the line drains, the next send is next.
    const before = clock.now();
    const next = limiter.acquire();
    await clock.runAll();
    await next;
    expect(clock.now() - before).toBeLessThanOrEqual(100);
  });

  it("rejects a rate that is not a positive number", () => {
    expect(() => createSendRateLimiter(0)).toThrow(RangeError);
    expect(() => createSendRateLimiter(Number.NaN)).toThrow(RangeError);
  });
});
