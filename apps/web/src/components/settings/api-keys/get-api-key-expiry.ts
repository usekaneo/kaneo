export type ApiKeyExpiry =
  | { status: "never" }
  | { status: "active" | "expired"; date: Date };

export function getApiKeyExpiry(
  expiresAt: Date | string | null | undefined,
  now: number = Date.now(),
): ApiKeyExpiry {
  if (!expiresAt) return { status: "never" };

  const date = new Date(expiresAt);
  return { status: date.getTime() <= now ? "expired" : "active", date };
}
