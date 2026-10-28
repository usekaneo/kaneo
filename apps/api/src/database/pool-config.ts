const DEFAULT_POOL_MAX = 10;
// Session-lock holders pin one client while their work queries through the
// pool, so a single client could never serve both.
const MIN_POOL_MAX = 2;

export function resolveDatabasePoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX?.trim();
  if (!raw) {
    return DEFAULT_POOL_MAX;
  }

  const value = Number(raw);
  if (
    !/^[1-9]\d*$/.test(raw) ||
    !Number.isSafeInteger(value) ||
    value < MIN_POOL_MAX
  ) {
    throw new Error(
      `DATABASE_POOL_MAX must be an integer of at least ${MIN_POOL_MAX}`,
    );
  }

  return value;
}
