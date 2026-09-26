import { readFileSync } from "node:fs";
import { asc, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";

const migration = readFileSync(
  new URL(
    "../../apps/api/drizzle/0054_backfill_instance_admin.sql",
    import.meta.url,
  ),
  "utf8",
);

function createUser(
  id: string,
  overrides: Partial<typeof schema.userTable.$inferInsert> = {},
) {
  return db.insert(schema.userTable).values({
    id,
    name: id,
    email: `${id}@example.com`,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  });
}

function roles() {
  return db
    .select({ id: schema.userTable.id, role: schema.userTable.role })
    .from(schema.userTable)
    .orderBy(asc(schema.userTable.id));
}

describe("legacy instance admin migration", () => {
  beforeEach(resetTestDatabase);

  it("promotes the oldest registered user and backfills missing roles", async () => {
    await createUser("newer", {
      createdAt: new Date("2026-01-01"),
      role: "user",
    });
    await createUser("oldest", { isAnonymous: null });
    await createUser("guest", {
      createdAt: new Date("2024-01-01"),
      isAnonymous: true,
    });
    await createUser("legacy", { createdAt: new Date("2025-06-01") });

    await db.execute(sql.raw(migration));
    const expected = [
      { id: "guest", role: "user" },
      { id: "legacy", role: "user" },
      { id: "newer", role: "user" },
      { id: "oldest", role: "admin" },
    ];
    expect(await roles()).toEqual(expected);
    await db.execute(sql.raw(migration));
    expect(await roles()).toEqual(expected);
  });

  it.each(["admin", "user,admin"])(
    "preserves an existing %s role without promoting another user",
    async (role) => {
      await createUser("oldest");
      await createUser("admin", {
        role,
        createdAt: new Date("2026-01-01"),
      });
      await db.execute(sql.raw(migration));
      expect(await roles()).toEqual([
        { id: "admin", role },
        { id: "oldest", role: "user" },
      ]);
    },
  );

  it("breaks creation-time ties by user ID", async () => {
    await createUser("b", { role: "user" });
    await createUser("a", { role: "user" });
    await db.execute(sql.raw(migration));
    expect(await roles()).toEqual([
      { id: "a", role: "admin" },
      { id: "b", role: "user" },
    ]);
  });

  it("does not let historical guest admins prevent registered-user promotion", async () => {
    await createUser("guest", { isAnonymous: true, role: "admin" });
    await createUser("registered");
    await db.execute(sql.raw(migration));
    expect(await roles()).toContainEqual({ id: "registered", role: "admin" });
  });

  it("leaves an empty instance ready for first-signup bootstrap", async () => {
    await db.execute(sql.raw(migration));
    expect(await roles()).toEqual([]);
  });

  it("never promotes an anonymous user on a guest-only instance", async () => {
    await createUser("guest", { isAnonymous: true });
    await db.execute(sql.raw(migration));
    expect(await roles()).toEqual([{ id: "guest", role: "user" }]);
  });
});
