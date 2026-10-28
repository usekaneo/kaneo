export function retryAfterMs(
  header: string | null,
  now = Date.now(),
): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

export function formatWait(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 120) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 120 ? `${minutes} min` : `${Math.ceil(minutes / 60)} h`;
}
