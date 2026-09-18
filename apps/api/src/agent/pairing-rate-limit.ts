// Pairing is the one unauthenticated agent call, so slow down guessing:
// 10 attempts per address per 10 minutes. In memory is enough; a code is
// single use, short lived and ~40 bits, so this only has to make guessing
// pointless, not be exact across instances.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const attempts = new Map<string, { count: number; resetAt: number }>();

export function allowPairingAttempt(key: string, now = Date.now()) {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (attempts.size > 10_000) {
      for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}
