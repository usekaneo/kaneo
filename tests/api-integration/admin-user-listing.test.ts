import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";

type AdminUserList = {
  users: { id: string; name: string; email: string; banned: boolean }[];
  total: number;
};

async function createUser(
  overrides: Partial<typeof schema.userTable.$inferInsert> & {
    name: string;
    email: string;
  },
) {
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: `user-${randomUUID()}`,
      emailVerified: true,
      ...overrides,
    })
    .returning();
  return user;
}

async function listUsers(
  app: ReturnType<typeof createApp>["app"],
  query: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  const search = new URLSearchParams(query).toString();
  return app.request(`/api/admin/users${search ? `?${search}` : ""}`, {
    headers,
  });
}

describe("API integration: admin user listing", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects users who are not instance administrators", async () => {
    const member = await createUser({
      name: "Regular Member",
      email: "member@example.com",
    });
    mockAuthenticatedSession(member);
    const { app } = createApp();

    const response = await listUsers(app);

    expect(response.status).toBe(403);
  });

  it("rejects API keys even when they belong to an administrator", async () => {
    const admin = await createUser({
      name: "Instance Admin",
      email: "admin@example.com",
      role: "admin",
    });
    mockAnonymousSession();
    const key = `test_${randomUUID()}`;
    await db.insert(schema.apikeyTable).values({
      referenceId: admin.id,
      userId: admin.id,
      key: createHash("sha256").update(key).digest("base64url"),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { app } = createApp();

    const response = await listUsers(app, {}, { "x-api-key": key });

    expect(response.status).toBe(403);
  });

  it("accepts administrators whose role list includes admin", async () => {
    const admin = await createUser({
      name: "Multi Role Admin",
      email: "multi@example.com",
      role: "user,admin",
    });
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    const response = await listUsers(app);

    expect(response.status).toBe(200);
    const body = (await response.json()) as AdminUserList;
    expect(body.users.map((user) => user.id)).toEqual([admin.id]);
  });

  it("searches name and email case-insensitively", async () => {
    const admin = await createUser({
      name: "Instance Admin",
      email: "admin@example.com",
      role: "admin",
    });
    const alice = await createUser({
      name: "Alice Wonder",
      email: "alice@example.com",
    });
    const bob = await createUser({ name: "Bob Builder", email: "bob@corp.io" });
    await createUser({ name: "Carol", email: "carol@example.com" });
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    const byName = (await (
      await listUsers(app, { search: "ALICE" })
    ).json()) as AdminUserList;
    expect(byName.total).toBe(1);
    expect(byName.users.map((user) => user.id)).toEqual([alice.id]);

    const byEmail = (await (
      await listUsers(app, { search: "Corp" })
    ).json()) as AdminUserList;
    expect(byEmail.total).toBe(1);
    expect(byEmail.users.map((user) => user.id)).toEqual([bob.id]);

    const wildcard = (await (
      await listUsers(app, { search: "%" })
    ).json()) as AdminUserList;
    expect(wildcard.total).toBe(0);
    expect(wildcard.users).toEqual([]);
  });

  it("pages newest users first and reports the total across pages", async () => {
    const admin = await createUser({
      name: "Instance Admin",
      email: "admin@example.com",
      role: "admin",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const users = [];
    for (let index = 0; index < 4; index += 1) {
      users.push(
        await createUser({
          name: `Member ${index}`,
          email: `member-${index}@example.com`,
          createdAt: new Date(`2026-02-0${index + 1}T00:00:00Z`),
          banned: index === 3,
        }),
      );
    }
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    const firstPage = (await (
      await listUsers(app, { limit: "2", page: "1" })
    ).json()) as AdminUserList;
    expect(firstPage.total).toBe(5);
    expect(firstPage.users.map((user) => user.id)).toEqual([
      users[3]?.id,
      users[2]?.id,
    ]);
    expect(firstPage.users[0]?.banned).toBe(true);
    expect(firstPage.users[1]?.banned).toBe(false);

    const lastPage = (await (
      await listUsers(app, { limit: "2", page: "3" })
    ).json()) as AdminUserList;
    expect(lastPage.total).toBe(5);
    expect(lastPage.users.map((user) => user.id)).toEqual([admin.id]);

    const beyond = (await (
      await listUsers(app, { limit: "2", page: "4" })
    ).json()) as AdminUserList;
    expect(beyond.users).toEqual([]);
    expect(beyond.total).toBe(5);
  });

  it("rejects invalid paging values", async () => {
    const admin = await createUser({
      name: "Instance Admin",
      email: "admin@example.com",
      role: "admin",
    });
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    expect((await listUsers(app, { page: "0" })).status).toBe(400);
    expect((await listUsers(app, { limit: "101" })).status).toBe(400);
    expect((await listUsers(app, { limit: "abc" })).status).toBe(400);
  });
});
