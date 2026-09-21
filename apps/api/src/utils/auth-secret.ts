export const MIN_AUTH_SECRET_LENGTH = 32;

// An unset secret is not merely a weak one: Better Auth substitutes a published
// default, which makes every session cookie forgeable offline.
export function resolveAuthSecret(raw = process.env.AUTH_SECRET): string {
  const secret = raw ?? "";
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Generate one with: openssl rand -hex 32",
    );
  }
  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(
      "AUTH_SECRET is less than 32 characters, please generate a new one.",
    );
  }
  return secret;
}
