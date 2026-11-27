import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

const repairMigration = readFileSync(
  new URL(
    "../../apps/api/drizzle/0074_repair_legacy_credential_accounts.sql",
    import.meta.url,
  ),
  "utf8",
);

const headers = {
  "content-type": "application/json",
  Origin: "http://localhost:5173",
};

function signUp(email: string, password: string, name = "Test User") {
  return createApp().app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ name, email, password }),
  });
}

function signIn(email: string, password: string) {
  return createApp().app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
  });
}

describe("legacy credential login migration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("repairs legacy email-keyed credential accounts and preserves OAuth accounts", async () => {
    const email = "legacy-admin@example.com";
    const password = "legacy-password-123";
    const signUpRes = await signUp(email, password, "Legacy Admin");
    expect(signUpRes.status).toBe(200);
    const { user } = (await signUpRes.json()) as { user: { id: string } };

    // Simulate a pre-Better-Auth user migrated by 0003 with email as account_id
    // plus a linked OAuth account that must remain untouched.
    await db
      .update(schema.accountTable)
      .set({ accountId: email })
      .where(
        and(
          eq(schema.accountTable.userId, user.id),
          eq(schema.accountTable.providerId, "credential"),
        ),
      );
    await db.insert(schema.accountTable).values({
      id: "oauth-github-row",
      accountId: "gh-user-42",
      providerId: "github",
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect((await signIn(email, password)).status).toBe(401);

    await db.execute(sql.raw(repairMigration));
    await db.execute(sql.raw(repairMigration));

    const repairedSignIn = await signIn(email, password);
    expect(repairedSignIn.status).toBe(200);

    const accounts = await db
      .select({
        providerId: schema.accountTable.providerId,
        accountId: schema.accountTable.accountId,
      })
      .from(schema.accountTable)
      .where(eq(schema.accountTable.userId, user.id));

    expect(accounts).toEqual(
      expect.arrayContaining([
        { providerId: "credential", accountId: user.id },
        { providerId: "github", accountId: "gh-user-42" },
      ]),
    );
  });

  it("drops stale legacy credential rows when a canonical row already exists", async () => {
    const email = "reset-user@example.com";
    const newPassword = "new-password-123";
    const signUpRes = await signUp(email, newPassword, "Reset User");
    expect(signUpRes.status).toBe(200);
    const { user } = (await signUpRes.json()) as { user: { id: string } };

    await db.insert(schema.accountTable).values({
      id: "stale-legacy-credential",
      accountId: email,
      providerId: "credential",
      userId: user.id,
      password: "old-bcrypt-hash-never-used",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    });

    await db.execute(sql.raw(repairMigration));

    const credentialRows = await db
      .select({
        id: schema.accountTable.id,
        accountId: schema.accountTable.accountId,
      })
      .from(schema.accountTable)
      .where(
        and(
          eq(schema.accountTable.userId, user.id),
          eq(schema.accountTable.providerId, "credential"),
        ),
      );

    expect(credentialRows).toHaveLength(1);
    expect(credentialRows[0]?.accountId).toBe(user.id);
    expect((await signIn(email, newPassword)).status).toBe(200);
  });

  it("normalizes mixed-case user emails without failing on case-colliding duplicates", async () => {
    const password = "case-password-123";
    const signUpRes = await signUp("case-user@example.com", password);
    expect(signUpRes.status).toBe(200);
    const { user } = (await signUpRes.json()) as { user: { id: string } };

    await db
      .update(schema.userTable)
      .set({ email: "Case-User@Example.COM" })
      .where(eq(schema.userTable.id, user.id));

    // Also insert a colliding pair to verify the uniqueness guard skips safely.
    await db.insert(schema.userTable).values([
      {
        id: "dup-lower",
        name: "Lower",
        email: "dup@example.com",
      },
      {
        id: "dup-upper",
        name: "Upper",
        email: "Dup@Example.com",
      },
    ]);

    expect((await signIn("Case-User@Example.COM", password)).status).toBe(401);

    await db.execute(sql.raw(repairMigration));

    const [repairedUser] = await db
      .select({ email: schema.userTable.email })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, user.id));
    expect(repairedUser?.email).toBe("case-user@example.com");

    expect((await signIn("Case-User@Example.COM", password)).status).toBe(200);
    expect((await signIn("case-user@example.com", password)).status).toBe(200);

    const [untouchedUpper] = await db
      .select({ email: schema.userTable.email })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, "dup-upper"));
    expect(untouchedUpper?.email).toBe("Dup@Example.com");
  });
});
