import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { verifyApiKey } from "../../apps/api/src/utils/verify-api-key";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(resetTestDatabase);
async function seedKey(
  overrides: Partial<typeof schema.apikeyTable.$inferInsert> = {},
) {
  const { user } = await createWorkspaceMember();
  const key = `review-test-${user.id}`.padEnd(64, "x");
  const [row] = await db
    .insert(schema.apikeyTable)
    .values({
      referenceId: user.id,
      userId: user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      createdAt: new Date(),
      updatedAt: new Date(),
      rateLimitEnabled: true,
      rateLimitMax: 2,
      rateLimitTimeWindow: 60000,
      ...overrides,
    })
    .returning();
  return { key, row };
}

describe("API key accounting", () => {
  it("denies an exhausted quota", async () => {
    const { key } = await seedKey({ remaining: 0 });
    expect(await verifyApiKey(key)).toBeNull();
  });
  it("enforces a rate window across concurrent requests", async () => {
    const { key, row } = await seedKey();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => verifyApiKey(key)),
    );
    expect(results.filter(Boolean)).toHaveLength(2);
    const [saved] = await db
      .select()
      .from(schema.apikeyTable)
      .where(eq(schema.apikeyTable.id, row.id));
    expect(saved.requestCount).toBe(2);
  });
  it("atomically consumes the last remaining request", async () => {
    const { key } = await seedKey({ remaining: 1, rateLimitEnabled: false });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => verifyApiKey(key)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it("refills eligible quota and resets an expired window", async () => {
    const old = new Date(Date.now() - 120000);
    const { key } = await seedKey({
      remaining: 0,
      refillAmount: 3,
      refillInterval: 60000,
      lastRefillAt: old,
      lastRequest: old,
      requestCount: 2,
    });
    expect(await verifyApiKey(key)).toMatchObject({ valid: true });
  });
});

it("charges an auth request once when the identity guard precedes Better Auth", async () => {
  const { key, row } = await seedKey({ remaining: 1, rateLimitEnabled: false });
  const { createApp } = await import("../../apps/api/src/index");
  const { app } = createApp();
  const response = await app.request("/api/auth/get-session", {
    headers: { "x-api-key": key },
  });
  expect(response.status, await response.clone().text()).toBe(200);
  expect(await response.json()).toMatchObject({
    user: { id: row.referenceId },
  });
  const [saved] = await db
    .select()
    .from(schema.apikeyTable)
    .where(eq(schema.apikeyTable.id, row.id));
  expect(saved.remaining).toBe(0);
});
