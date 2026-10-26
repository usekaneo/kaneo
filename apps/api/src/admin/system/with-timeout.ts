export class ProbeTimeoutError extends Error {
  constructor() {
    super("Timed out");
    this.name = "ProbeTimeoutError";
  }
}

/**
 * Resolve with `work`, or reject with ProbeTimeoutError after `ms`. The
 * abandoned promise keeps running, so its later rejection is swallowed here
 * instead of surfacing as an unhandled rejection.
 */
export function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = work(controller.signal);
  pending.catch(() => {});
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Settle first: aborting can reject `work` synchronously, and that
      // abort error must not win the race over the timeout.
      reject(new ProbeTimeoutError());
      controller.abort();
    }, ms);
  });
  return Promise.race([pending, timeout]).finally(() => clearTimeout(timer));
}
