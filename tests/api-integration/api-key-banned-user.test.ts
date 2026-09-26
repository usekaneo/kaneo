import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { verifyApiKey } from "../../apps/api/src/utils/verify-api-key";
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
});
