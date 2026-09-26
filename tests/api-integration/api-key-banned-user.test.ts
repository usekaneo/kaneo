import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { verifyApiKey } from "../../apps/api/src/utils/verify-api-key";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

async function createUserWithKey(
  ban: Partial<
    Pick<typeof schema.userTable.$inferInsert, "banned" | "banExpires">
  >,
) {
  const userId = `user-${randomUUID()}`;
  await db.insert(schema.userTable).values({
    id: userId,
    email: `${userId}@example.com`,
    emailVerified: true,
    name: "Key Owner",
    ...ban,
  });
  const key = `test_${randomUUID()}`;
  await db.insert(schema.apikeyTable).values({
    referenceId: userId,
    userId,
    key: createHash("sha256").update(key).digest("base64url"),
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { userId, key };
}

describe("API integration: API keys of banned users", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("accepts the key of a user who is not banned", async () => {
    const { userId, key } = await createUserWithKey({ banned: false });

    const result = await verifyApiKey(key);

    expect(result?.key.userId).toBe(userId);
  });

  it("accepts the key when the banned flag was never set", async () => {
    const { userId, key } = await createUserWithKey({ banned: null });

    const result = await verifyApiKey(key);

    expect(result?.key.userId).toBe(userId);
  });

  it("rejects the key of a banned user", async () => {
    const { key } = await createUserWithKey({ banned: true });

    expect(await verifyApiKey(key)).toBeNull();
  });

  it("rejects the key while a temporary ban is still active", async () => {
    const { key } = await createUserWithKey({
      banned: true,
      banExpires: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(await verifyApiKey(key)).toBeNull();
  });

  it("accepts the key once a temporary ban has expired", async () => {
    const { userId, key } = await createUserWithKey({
      banned: true,
      banExpires: new Date(Date.now() - 60 * 60 * 1000),
    });

    const result = await verifyApiKey(key);

    expect(result?.key.userId).toBe(userId);
  });

  describe("through Better Auth routes", () => {
    async function mintKey() {
      const { app } = createApp();
      const owner = await signUpWithSession(app, {
        email: `${randomUUID()}@example.com`,
        name: "Key Owner",
      });
      const created = await app.request("/api/auth/api-key/create", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner.cookies },
        body: JSON.stringify({ name: "test" }),
      });
      expect(created.status).toBe(200);
      const { key } = (await created.json()) as { key: string };
      return { app, userId: owner.userId, key };
    }

    async function ban(userId: string) {
      await db
        .update(schema.userTable)
        .set({ banned: true })
        .where(eq(schema.userTable.id, userId));
    }

    it("resolves a session for an active key and refuses it once banned", async () => {
      const { app, userId, key } = await mintKey();
      const headers = { "x-api-key": key };

      const active = await app.request("/api/auth/get-session", { headers });
      expect(active.status).toBe(200);
      const body = (await active.json()) as { user?: { id: string } };
      expect(body.user?.id).toBe(userId);

      await ban(userId);

      const banned = await app.request("/api/auth/get-session", { headers });
      expect(banned.status).toBe(401);
    });

    it("applies the same rule to a bearer key on other auth routes", async () => {
      const { app, userId, key } = await mintKey();
      const headers = { authorization: `Bearer ${key}` };

      const active = await app.request("/api/auth/api-key/list", { headers });
      expect(active.status).toBe(200);

      await ban(userId);

      const banned = await app.request("/api/auth/api-key/list", { headers });
      expect(banned.status).toBe(401);
    });
  });
});
