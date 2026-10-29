export async function renewWhileRunning<T>(
  run: () => Promise<T>,
  renew: () => void,
  intervalMs: number,
): Promise<T> {
  const timer = setInterval(renew, intervalMs);
  try {
    return await run();
  } finally {
    clearInterval(timer);
  }
}
