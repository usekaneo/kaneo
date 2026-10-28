import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
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
    expect(await verifyApiKey(key)).toEqual({
      status: "usage_exceeded",
      retryAt: null,
      rateLimit: { limit: 2, remaining: 2, resetAt: expect.any(Date) },
    });
  });
  it("enforces a rate window across concurrent requests", async () => {
    const { key, row } = await seedKey();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => verifyApiKey(key)),
    );
    expect(results.filter((r) => r?.status === "valid")).toHaveLength(2);
    expect(results.filter((r) => r?.status === "rate_limited")).toHaveLength(4);
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
    expect(results.filter((r) => r?.status === "valid")).toHaveLength(1);
    expect(results.filter((r) => r?.status === "usage_exceeded")).toHaveLength(
      4,
    );
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
    expect(await verifyApiKey(key)).toMatchObject({ status: "valid" });
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

it("creates normal API keys with the configured 100-per-minute limit", async () => {
  const { user } = await createWorkspaceMember();
  const created = await auth.api.createApiKey({
    body: { userId: user.id, name: "default limits" },
  });
  const [saved] = await db
    .select()
    .from(schema.apikeyTable)
    .where(eq(schema.apikeyTable.id, created.id));
  expect(saved.rateLimitMax).toBe(100);
  expect(saved.rateLimitTimeWindow).toBe(60_000);
  for (let i = 0; i < 11; i++)
    expect(await verifyApiKey(created.key)).toMatchObject({ status: "valid" });
});

async function holdRowLock(id: string) {
  let release!: () => void;
  let ready!: () => void;
  const locked = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const holder = db.transaction(async (tx) => {
    await tx
      .select()
      .from(schema.apikeyTable)
      .where(eq(schema.apikeyTable.id, id))
      .for("update");
    ready();
    await hold;
  });
  await locked;
  return { release, holder };
}

it("reads a key without waiting for its row lock", async () => {
  const { key, row } = await seedKey({ remaining: 1 });
  const { release, holder } = await holdRowLock(row.id);
  try {
    const result = await Promise.race([
      verifyApiKey(key, { consume: false }),
      new Promise((resolve) => setTimeout(() => resolve("blocked"), 2_000)),
    ]);
    expect(result).toMatchObject({
      status: "valid",
      rateLimit: { limit: 2, remaining: 2 },
    });
  } finally {
    release();
    await holder;
  }
});

it("rejects a key that expires while waiting for its row lock", async () => {
  const expiresAt = new Date(Date.now() + 1200);
  const { key, row } = await seedKey({ expiresAt, remaining: 1 });
  const { release, holder } = await holdRowLock(row.id);
  try {
    const verification = verifyApiKey(key);
    let waiting = false;
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      const result = await getDatabasePool().query<{ waiting: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%"apikey"%') AS waiting`,
      );
      waiting = result.rows[0].waiting;
      if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(waiting).toBe(true);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, expiresAt.getTime() - Date.now() + 50)),
    );
    release();
    await expect(verification).resolves.toBeNull();
    const [saved] = await db
      .select()
      .from(schema.apikeyTable)
      .where(eq(schema.apikeyTable.id, row.id));
    expect(saved.remaining).toBe(1);
    expect(saved.requestCount).toBe(0);
  } finally {
    release();
    await holder;
  }
});
