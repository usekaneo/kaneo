const MAX_SECONDS = 2_147_483_647;

const UNIT_SECONDS: Record<string, number> = {
  w: 7 * 24 * 3600,
  d: 24 * 3600,
  h: 3600,
  m: 60,
  s: 1,
};

/**
 * Parse a human time-estimate string into seconds.
 * Accepts combinations like "2h 30m", "1.5h", "90m", "45s", "2d", "1w".
 * A bare number ("90") is treated as minutes.
 * Returns 0 for zero input (callers treat it as "clear"), null for
 * empty/invalid input.
 */
export function parseTimeEstimate(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Bare number → minutes.
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const seconds = Math.round(Number(trimmed) * 60);
    return seconds >= 0 && seconds <= MAX_SECONDS ? seconds : null;
  }

  const matches = [...trimmed.matchAll(/(\d+(?:\.\d+)?)\s*([wdhms])/g)];
  if (matches.length === 0) return null;

  // The whole input must be consumed by number+unit pairs (plus whitespace).
  const consumed = matches.map((m) => m[0]).join("");
  const stripped = trimmed.replace(/\s+/g, "");
  const consumedStripped = consumed.replace(/\s+/g, "");
  if (stripped !== consumedStripped) return null;

  let total = 0;
  for (const [, amount, unit] of matches) {
    total += Number(amount) * (UNIT_SECONDS[unit] ?? 0);
  }

  total = Math.round(total);
  if (!Number.isFinite(total) || total < 0 || total > MAX_SECONDS) return null;
  return total;
}

/**
 * Format estimate seconds for display, using only hours, minutes and seconds.
 * Zero units are trimmed: 5400 → "1h 30m", 90 → "1m 30s", 90000 → "25h".
 */
export function formatTimeEstimate(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  if (seconds <= 0) return "0m";

  const hours = Math.floor(seconds / UNIT_SECONDS.h);
  const minutes = Math.floor((seconds % UNIT_SECONDS.h) / UNIT_SECONDS.m);
  const remaining = Math.round(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remaining > 0) parts.push(`${remaining}s`);
  return parts.join(" ") || "0m";
}
