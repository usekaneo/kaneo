import type { EmailSubject } from "../../packages/email/src/brand";
import * as email from "@kaneo/email";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { adminWithTarget } from "./helpers/admin/admin-users-api";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";

type Created = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
    signInMethods: string[];
    lastActiveAt: string | null;
  };
  passwordSetupEmail: string;
};

const newUser = { name: "Nora New", email: "Nora@Example.com", role: "admin" };

let setup: Awaited<ReturnType<typeof adminWithTarget>>;

beforeEach(async () => {
  await resetTestDatabase();
  setup = await adminWithTarget();
  vi.spyOn(email, "isSmtpConfigured").mockReturnValue(true);
  vi.spyOn(email, "sendAccountPasswordEmail").mockResolvedValue({
    success: true,
  });
});
afterEach(() => vi.unstubAllEnvs());

const create = (body: unknown = newUser) =>
  setup.asAdmin("", { method: "POST", body });

async function createdRows() {
  return (await readAuditLog()).filter((row) => row.action === "user.created");
}

describe("POST /api/admin/users", () => {
  it("creates the account without a password and emails a link to set one", async () => {
    const response = await create();
    const text = await response.text();
    expect(response.status, text).toBe(201);
    const { user, passwordSetupEmail } = JSON.parse(text) as Created;
    expect(passwordSetupEmail).toBe("sent");
    expect(user).toMatchObject({
      name: "Nora New",
      email: "nora@example.com",
      role: "admin",
      emailVerified: false,
      signInMethods: [],
      lastActiveAt: null,
    });
    expect(
      await db
        .select()
        .from(schema.accountTable)
        .where(eq(schema.accountTable.userId, user.id)),
    ).toEqual([]);

    expect(email.sendAccountPasswordEmail).toHaveBeenCalledOnce();
    const [to, subject, data] = vi.mocked(email.sendAccountPasswordEmail).mock
      .calls[0] as [
      string,
      EmailSubject,
      { purpose: string; passwordLink: string },
    ];
    expect(to).toBe("nora@example.com");
    expect(typeof subject === "function" ? subject("Kaneo") : subject).toBe(
      "Set up your Kaneo account",
    );
    expect(data.purpose).toBe("setup");
    const link = new URL(data.passwordLink);
    const token = link.pathname.split("/").at(-1) as string;
    expect(text).not.toContain(token);

    const [verification] = await db.select().from(schema.verificationTable);
    const lifetime = (verification?.expiresAt.getTime() ?? 0) - Date.now();
    expect(lifetime).toBeGreaterThan(47 * 3_600_000);
    expect(lifetime).toBeLessThanOrEqual(48 * 3_600_000);

    const audit = await createdRows();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorUserId: setup.admin.userId,
      targetType: "user",
      targetId: user.id,
      targetLabel: "nora@example.com",
      metadata: { name: "Nora New", role: "admin", signIn: "password_link" },
      userAgent: "admin-users-test",
    });
    expect(JSON.stringify(audit)).not.toContain(token);

    // The emailed link goes through the regular reset flow.
    const callback = await setup.app.request(data.passwordLink);
    expect(callback.status).toBe(302);
    const redirect = new URL(callback.headers.get("location") as string);
    expect(`${redirect.origin}${redirect.pathname}`).toBe(
      "http://localhost:5173/auth/reset-password",
    );
    expect(redirect.searchParams.get("token")).toBe(token);
    expect(redirect.searchParams.has("error")).toBe(false);
    const post = (path: string, body: unknown) =>
      setup.app.request(`/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const password = "a fresh password 123";
    expect(
      (await post("/reset-password", { token, newPassword: password })).status,
    ).toBe(200);
    expect(
      (await post("/sign-in/email", { email: "nora@example.com", password }))
        .status,
    ).toBe(200);
  });

  it("rejects a duplicate email regardless of case", async () => {
    const response = await create({
      ...newUser,
      email: "TARGET@example.com",
    });
    expect(response.status).toBe(409);
    expect((await readErrorBody(response)).code).toBe("USER_ALREADY_EXISTS");
    expect(await createdRows()).toEqual([]);
    expect(email.sendAccountPasswordEmail).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    for (const body of [
      { ...newUser, email: "not-an-email" },
      { ...newUser, name: "  " },
      { ...newUser, role: "owner" },
    ]) {
      expect((await create(body)).status).toBe(400);
    }
    expect(await createdRows()).toEqual([]);
  });

  it("tells the administrator when email delivery is not configured", async () => {
    vi.mocked(email.isSmtpConfigured).mockReturnValue(false);
    const response = await create();
    expect(response.status).toBe(201);
    expect(((await response.json()) as Created).passwordSetupEmail).toBe(
      "not_configured",
    );
    expect(email.sendAccountPasswordEmail).not.toHaveBeenCalled();
    expect(await db.select().from(schema.verificationTable)).toEqual([]);
    expect(await createdRows()).toHaveLength(1);
  });

  it("reports a failed delivery but keeps the account", async () => {
    vi.mocked(email.sendAccountPasswordEmail).mockRejectedValue(
      new Error("SMTP down"),
    );
    const response = await create();
    expect(response.status).toBe(201);
    expect(((await response.json()) as Created).passwordSetupEmail).toBe(
      "failed",
    );
    expect(await createdRows()).toHaveLength(1);
  });

  it("creates single sign-on accounts when password registration is disabled", async () => {
    vi.stubEnv("DISABLE_PASSWORD_REGISTRATION", "true");
    const response = await create();
    expect(response.status).toBe(201);
    const body = (await response.json()) as Created;
    expect(body.passwordSetupEmail).toBe("not_needed");
    expect(body.user.emailVerified).toBe(true);
    expect(email.sendAccountPasswordEmail).not.toHaveBeenCalled();
    expect((await createdRows())[0]?.metadata).toMatchObject({
      signIn: "single_sign_on",
    });
  });

  it("is not blocked by closed registration", async () => {
    vi.stubEnv("DISABLE_REGISTRATION", "true");
    expect((await create()).status).toBe(201);
  });

  it("rejects disposable addresses on Kaneo Cloud", async () => {
    vi.stubEnv("KANEO_CLOUD", "true");
    const response = await create({ ...newUser, email: "x@mailinator.com" });
    expect(response.status).toBe(400);
    expect((await readErrorBody(response)).code).toBe(
      "DISPOSABLE_EMAIL_NOT_ALLOWED",
    );
    expect(await createdRows()).toEqual([]);
  });
});
