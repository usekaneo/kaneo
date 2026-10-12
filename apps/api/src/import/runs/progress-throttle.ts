export type ProgressThrottle = {
  report(message: string): void;
  cancel(): void;
};

export function createProgressThrottle(
  write: (message: string) => void,
  intervalMs = 1000,
  now: () => number = Date.now,
): ProgressThrottle {
  let lastWrite = Number.NEGATIVE_INFINITY;
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    timer = null;
    if (pending === null) return;
    const message = pending;
    pending = null;
    lastWrite = now();
    write(message);
  }

  return {
    report(message) {
      pending = message;
      if (timer) return;
      const wait = lastWrite + intervalMs - now();
      if (wait <= 0) {
        flush();
        return;
      }
      timer = setTimeout(flush, wait);
      timer.unref?.();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
