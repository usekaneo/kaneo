import { z } from "../openapi";

const id = z.string().min(1).max(200);

export const adminUserParam = z.object({ userId: id });

export const adminUserSessionParam = z.object({ userId: id, sessionId: id });

export const adminUserApiKeyParam = z.object({ userId: id, apiKeyId: id });

const isoTimestamp = z.string().openapi({ format: "date-time" });

export const adminApiKeySchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    start: z.string().nullable().openapi({
      description:
        "The first characters of the key, kept for recognizing it. The key itself and its hash are never returned.",
    }),
    enabled: z.boolean(),
    createdAt: isoTimestamp,
    lastUsedAt: isoTimestamp.nullable(),
    expiresAt: isoTimestamp.nullable(),
  })
  .openapi("AdminApiKey");

export const adminApiKeyListSchema = z
  .object({ apiKeys: z.array(adminApiKeySchema) })
  .openapi("AdminApiKeyList");

export const adminRevokedApiKeySchema = z
  .object({ revoked: z.number().int() })
  .openapi("AdminRevokedApiKey");
