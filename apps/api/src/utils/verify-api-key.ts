import { createHash } from "node:crypto";
import { and, eq, exists, gt, isNull, or, sql } from "drizzle-orm";
import db, { schema } from "../database";
import { notBannedCondition } from "./user-ban";

async function hashApiKey(key: string): Promise<string> {
  const hash = createHash("sha256").update(key).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function parsePermissions(raw: string | null): Record<string, string[]> | null {
  if (raw === null) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const permissions: Record<string, string[]> = {};
  for (const [resource, actions] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (!Array.isArray(actions)) return {};
    if (actions.some((action) => typeof action !== "string")) return {};
    permissions[resource] = actions as string[];
  }
  return permissions;
}

export async function verifyApiKey(
  key: string,
  options: { consume?: boolean } = {},
) {
  const hashedKey = await hashApiKey(key);

  return db.transaction(async (tx) => {
    const [apiKey] = await tx
      .select()
      .from(schema.apikeyTable)
      .where(
        and(
          eq(schema.apikeyTable.key, hashedKey),
          eq(schema.apikeyTable.enabled, true),
          // Fail closed even before legacy databases finish the repair migration.
          exists(
            db
              .select({ id: schema.userTable.id })
              .from(schema.userTable)
              .where(
                and(
                  eq(
                    schema.userTable.id,
                    sql`coalesce(${schema.apikeyTable.referenceId}, ${schema.apikeyTable.userId})`,
                  ),
                  notBannedCondition(),
                ),
              ),
          ),
          or(
            isNull(schema.apikeyTable.expiresAt),
            gt(schema.apikeyTable.expiresAt, new Date()),
          ),
        ),
      )
      .limit(1)
      .for("update");

    if (!apiKey) {
      return null;
    }
    // A key may expire while SELECT waits for another request's row lock.
    const now = new Date();
    if (apiKey.expiresAt && apiKey.expiresAt <= now) return null;

    if (options.consume === false)
      return {
        valid: true,
        key: {
          ...apiKey,
          userId: apiKey.referenceId ?? apiKey.userId ?? "",
          enabled: apiKey.enabled ?? false,
          permissions: parsePermissions(apiKey.permissions),
          metadata: null,
        },
      };

    // Locking the key serializes quota/refill and window accounting across API
    // instances. Neither a stale lookup nor a rejected request can restore quota.
    let remaining = apiKey.remaining;
    let lastRefillAt = apiKey.lastRefillAt;
    if (remaining !== null) {
      if (
        apiKey.refillInterval &&
        apiKey.refillAmount &&
        now.getTime() - (lastRefillAt ?? apiKey.createdAt).getTime() >=
          apiKey.refillInterval
      ) {
        remaining = apiKey.refillAmount;
        lastRefillAt = now;
      }
      if (remaining <= 0) return null;
    }
    let requestCount = apiKey.requestCount ?? 0;
    if (apiKey.rateLimitEnabled) {
      const window = apiKey.rateLimitTimeWindow ?? 60_000;
      if (
        !apiKey.lastRequest ||
        now.getTime() - apiKey.lastRequest.getTime() >= window
      )
        requestCount = 0;
      if (requestCount >= (apiKey.rateLimitMax ?? 100)) return null;
    }
    if (remaining !== null) remaining--;
    if (apiKey.rateLimitEnabled) requestCount++;
    await tx
      .update(schema.apikeyTable)
      .set({
        remaining,
        lastRefillAt,
        requestCount,
        lastRequest: now,
        updatedAt: now,
      })
      .where(eq(schema.apikeyTable.id, apiKey.id));

    return {
      valid: true,
      key: {
        id: apiKey.id,
        userId: apiKey.referenceId ?? apiKey.userId ?? "",
        name: apiKey.name,
        prefix: apiKey.prefix,
        start: apiKey.start,
        enabled: apiKey.enabled ?? false,
        expiresAt: apiKey.expiresAt,
        permissions: parsePermissions(apiKey.permissions),
        refillInterval: apiKey.refillInterval,
        refillAmount: apiKey.refillAmount,
        lastRefillAt,
        rateLimitEnabled: apiKey.rateLimitEnabled,
        rateLimitTimeWindow: apiKey.rateLimitTimeWindow,
        rateLimitMax: apiKey.rateLimitMax,
        requestCount,
        remaining,
        lastRequest: now,
        metadata: apiKey.metadata
          ? (JSON.parse(apiKey.metadata) as Record<string, unknown>)
          : null,
      },
    };
  });
}
