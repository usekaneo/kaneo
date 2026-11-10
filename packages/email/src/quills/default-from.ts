/**
 * Optional override for the platform default From.
 *
 * The package default is `EMAIL_FROM`. The app installs a resolver that reads
 * the active workspace's registry `email.from`. With no workspace scope
 * (self-host, and pooled sends outside a scope) the resolver returns null
 * and this falls through to `EMAIL_FROM`.
 */
let resolver: (() => string | null | undefined) | null = null;

export function setDefaultFromResolver(
  fn: () => string | null | undefined,
): void {
  resolver = fn;
}

export function resetDefaultFromResolver(): void {
  resolver = null;
}

/** The resolver's answer, or null to fall through to EMAIL_FROM. */
export function resolvedDefaultFrom(): string | null {
  const value = resolver?.();
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
