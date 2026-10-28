import type { FetchLike } from "../types.js";

export const MAX_PACE_MS = 60_000;

export type PacingOptions = {
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

export function createPacedFetch(
  fetchImpl: FetchLike,
  options: PacingOptions = {},
): FetchLike {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? sleepFor;
  let resumeAt = 0;

  return async (input, init) => {
    const delay = Math.min(MAX_PACE_MS, resumeAt - now());
    if (delay > 0) await sleep(delay, init?.signal ?? undefined);
    const res = await fetchImpl(input, init);
    resumeAt = pauseUntil(res.headers, now());
    return res;
  };
}

export function pauseUntil(headers: Headers, nowMs: number): number {
  const remaining = headerNumber(headers.get("x-ratelimit-remaining"));
  const reset = headerNumber(headers.get("x-ratelimit-reset"));
  if (remaining === undefined || reset === undefined || remaining > 1) {
    return 0;
  }

  const resetMs =
    reset > 1e12 ? reset : reset > 1e9 ? reset * 1000 : nowMs + reset * 1000;
  return resetMs > nowMs ? resetMs : 0;
}

function headerNumber(value: string | null): number | undefined {
  if (value === null || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sleepFor(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
