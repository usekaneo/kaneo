import { createHash } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import db, { schema } from "../database";

async function hashApiKey(key: string): Promise<string> {
  const hash = createHash("sha256").update(key).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function verifyApiKey(key: string) {
  const hashedKey = await hashApiKey(key);

  const [apiKey] = await db
    .select()
    .from(schema.apikeyTable)
    .where(
      and(
        eq(schema.apikeyTable.key, hashedKey),
        eq(schema.apikeyTable.enabled, true),
        or(
          isNull(schema.apikeyTable.expiresAt),
          gt(schema.apikeyTable.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);

  if (!apiKey) {
    return null;
  }

  return {
    valid: true,
    key: {
      id: apiKey.id,
      userId: apiKey.userId,
      name: apiKey.name,
      prefix: apiKey.prefix,
      start: apiKey.start,
      enabled: apiKey.enabled ?? false,
      expiresAt: apiKey.expiresAt,
      permissions: apiKey.permissions
        ? (JSON.parse(apiKey.permissions) as Record<string, string[]>)
        : null,
      refillInterval: apiKey.refillInterval,
      refillAmount: apiKey.refillAmount,
      lastRefillAt: apiKey.lastRefillAt,
      rateLimitEnabled: apiKey.rateLimitEnabled,
      rateLimitTimeWindow: apiKey.rateLimitTimeWindow,
      rateLimitMax: apiKey.rateLimitMax,
      requestCount: apiKey.requestCount,
      remaining: apiKey.remaining,
      lastRequest: apiKey.lastRequest,
      metadata: apiKey.metadata
        ? (JSON.parse(apiKey.metadata) as Record<string, unknown>)
        : null,
    },
  };
}
