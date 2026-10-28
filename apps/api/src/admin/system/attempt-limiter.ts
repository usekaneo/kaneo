type AttemptLimiterOptions = {
  max: number;
  windowMs: number;
  now?: () => number;
};

export type AttemptDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * A per-key sliding window kept in memory. Each API instance counts on its
 * own, which is enough to stop an administrator from flooding a mailbox.
 */
export function createAttemptLimiter({
  max,
  windowMs,
  now = Date.now,
}: AttemptLimiterOptions) {
  const attempts = new Map<string, number[]>();

  return {
    take(key: string): AttemptDecision {
      const current = now();
      const recent = (attempts.get(key) ?? []).filter(
        (at) => current - at < windowMs,
      );
      if (recent.length >= max) {
        attempts.set(key, recent);
        const oldest = recent[0] ?? current;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((oldest + windowMs - current) / 1000),
          ),
        };
      }
      recent.push(current);
      attempts.set(key, recent);
      return { allowed: true };
    },
  };
}
