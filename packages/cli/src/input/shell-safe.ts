const SAFE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export function isShellSafe(value: string): boolean {
  return SAFE.test(value);
}

export function shellSafeOr(value: string | null, fallback: string): string {
  return value !== null && isShellSafe(value) ? value : fallback;
}
