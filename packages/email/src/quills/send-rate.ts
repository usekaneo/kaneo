/**
 * A per-process pace for outbound sends.
 *
 * A provider account has one sending rate, and a bulk notification (a
 * changelog going to every subscriber) fans out into one job per recipient that
 * the queue runs as fast as its concurrency allows. Unpaced, that burst is the
 * provider's rate limit, met head on; paced, it is the same mail a little later.
 *
 * ## Shape
 *
 * Virtual scheduling rather than a token bucket. Each caller is handed the next
 * free slot at the moment it asks (`max(now, last slot + interval)`) and sleeps
 * until then, so sends leave exactly one interval apart with no burst allowance:
 * a bucket that starts full lets `rate` sends out at once and `rate` more in the
 * following second, which is twice the rate inside one window and the shape a
 * per-second limit counts.
 *
 * - **Order.** Slots are handed out in call order and never revisited, so sends
 *   leave in the order they asked; nobody can be overtaken and starve.
 * - **No lock.** A caller holds nothing while it waits: it owns one timer and
 *   one slot, so there is nothing for two waiters to deadlock on.
 * - **Bounded.** A caller whose slot would be more than `maxWaitMs` away is
 *   refused at once instead of queued, and reserves nothing. The state is one
 *   number, and the most callers ever parked is `maxWaitMs × rate` (a 5,000-send
 *   burst at 10/s with a 30s cap parks 300 and turns 4,700 away).
 *
 * The clock is monotonic (`performance.now`), so a wall-clock step cannot
 * release a line early or freeze it.
 */

/** The clock a limiter reads and sleeps on; injectable so tests own time. */
export interface SendRateClock {
  /** Milliseconds on a monotonic clock. */
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface SendRateLimiter {
  /** Sends per second this limiter lets through. */
  readonly ratePerSecond: number;
  /**
   * Resolve when this caller may send. Throws {@link SendRateQueueFullError}
   * when the wait would pass the cap.
   */
  acquire(): Promise<void>;
}

/** The line is longer than a caller should wait in; nothing was reserved. */
export class SendRateQueueFullError extends Error {
  constructor(readonly waitMs: number) {
    super(`send rate queue full: next slot is ${Math.ceil(waitMs)}ms away`);
    this.name = "SendRateQueueFullError";
  }
}

/**
 * Longest a send waits for its slot before it is refused instead.
 *
 * Half the job queue's default lease, so a job parked on a slot never looks
 * abandoned even before its heartbeat renews it, and short enough that a send
 * on a request path (a sign-in link) is not held for longer than a person would
 * wait. A refused send is a retryable failure: the queue takes it again later,
 * when the line has drained, rather than holding a worker slot for minutes.
 */
export const DEFAULT_MAX_SEND_WAIT_MS = 30_000;

const systemClock: SendRateClock = {
  now: () => performance.now(),
  sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

export function createSendRateLimiter(
  ratePerSecond: number,
  options: { maxWaitMs?: number; clock?: SendRateClock } = {},
): SendRateLimiter {
  if (!Number.isFinite(ratePerSecond) || ratePerSecond <= 0) {
    throw new RangeError(
      `send rate must be a positive number, got ${ratePerSecond}`,
    );
  }
  const intervalMs = 1000 / ratePerSecond;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_SEND_WAIT_MS;
  const clock = options.clock ?? systemClock;
  /** When the next caller may go. In the past whenever the line is empty. */
  let nextSlotAt = Number.NEGATIVE_INFINITY;

  return {
    ratePerSecond,
    async acquire() {
      const now = clock.now();
      const slotAt = Math.max(now, nextSlotAt);
      const waitMs = slotAt - now;
      // Checked before the slot is taken, so a refusal costs the line nothing.
      if (waitMs > maxWaitMs) throw new SendRateQueueFullError(waitMs);
      nextSlotAt = slotAt + intervalMs;
      if (waitMs > 0) await clock.sleep(waitMs);
    },
  };
}
