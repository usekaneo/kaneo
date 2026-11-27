import { readFileSync } from "node:fs";
import * as email from "@kaneo/email";
import { and, eq, sql } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { drainSignInEmails } from "../../apps/api/src/utils/sign-in-email-tasks";
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

function signUp(userEmail: string, password: string, name = "Test User") {
  return createApp().app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ name, email: userEmail, password }),
  });
}

function signIn(userEmail: string, password: string) {
  return createApp().app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ email: userEmail, password }),
  });
}

describe("legacy credential login migration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("repairs legacy email-keyed credential accounts and preserves OAuth accounts", async () => {
    const userEmail = "legacy-admin@example.com";
    const password = "legacy-password-123";
    const signUpRes = await signUp(userEmail, password, "Legacy Admin");
    expect(signUpRes.status).toBe(200);
    const { user } = (await signUpRes.json()) as { user: { id: string } };

    // Simulate a pre-Better-Auth user migrated by 0003 with email as account_id
    // plus a linked OAuth account that must remain untouched.
    await db
      .update(schema.accountTable)
      .set({ accountId: userEmail })
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

    expect((await signIn(userEmail, password)).status).toBe(401);

    await db.execute(sql.raw(repairMigration));
    await db.execute(sql.raw(repairMigration));

    const repairedSignIn = await signIn(userEmail, password);
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

  it("drops stale legacy credential rows when a canonical row already holds a password", async () => {
    const userEmail = "reset-user@example.com";
    const newPassword = "new-password-123";
    const signUpRes = await signUp(userEmail, newPassword, "Reset User");
    expect(signUpRes.status).toBe(200);
    const { user } = (await signUpRes.json()) as { user: { id: string } };

    await db.insert(schema.accountTable).values({
      id: "stale-legacy-credential",
      accountId: userEmail,
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
    expect((await signIn(userEmail, newPassword)).status).toBe(200);
  });

  it("preserves the legacy password hash when a canonical credential row has a null password", async () => {
    const userEmail = "null-canonical@example.com";
    const password = "preserved-password-123";
    const signUpRes = await signUp(userEmail, password, "Null Canonical");
    expect(signUpRes.status).toBe(200);
    const { user } = (await signUpRes.json()) as { user: { id: string } };

    const [canonical] = await db
      .select({ password: schema.accountTable.password })
      .from(schema.accountTable)
      .where(
        and(
          eq(schema.accountTable.userId, user.id),
          eq(schema.accountTable.providerId, "credential"),
        ),
      );

    await db
      .update(schema.accountTable)
      .set({ password: null })
      .where(
        and(
          eq(schema.accountTable.userId, user.id),
          eq(schema.accountTable.providerId, "credential"),
        ),
      );

    await db.insert(schema.accountTable).values({
      id: "legacy-password-holder",
      accountId: userEmail,
      providerId: "credential",
      userId: user.id,
      password: canonical?.password,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    });

    await db.execute(sql.raw(repairMigration));

    const credentialRows = await db
      .select({
        accountId: schema.accountTable.accountId,
        password: schema.accountTable.password,
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
    expect(credentialRows[0]?.password).toBe(canonical?.password);
    expect((await signIn(userEmail, password)).status).toBe(200);
  });

  it("normalizes mixed-case user emails without colliding and keeps locale lookup working for legacy casing", async () => {
    const password = "case-password-123";
    const signUpRes = await signUp("case-user@example.com", password);
    expect(signUpRes.status).toBe(200);
    const { user } = (await signUpRes.json()) as { user: { id: string } };

    await db
      .update(schema.userTable)
      .set({ email: "Case-User@Example.COM", locale: "de-DE" })
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

    const otpSpy = vi.spyOn(email, "sendOtpEmail").mockResolvedValue(undefined);
    const otpRes = await createApp().app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "Case-User@Example.COM",
          type: "sign-in",
        }),
      },
    );
    expect(otpRes.status).toBe(200);
    await drainSignInEmails();

    expect(otpSpy).toHaveBeenCalledTimes(1);
    const [sentTo, subjectFn, otpData] = otpSpy.mock.calls[0] ?? [];
    expect(sentTo?.toLowerCase()).toBe("case-user@example.com");
    expect(typeof subjectFn === "function" ? subjectFn("Kaneo") : "").toContain(
      "ist dein Kaneo-Anmeldecode",
    );
    expect(otpData).toMatchObject({ locale: "de-DE" });
  });
});
