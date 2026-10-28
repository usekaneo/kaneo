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

let setup: Awaited<ReturnType<typeof adminWithTarget>>;

beforeEach(async () => {
  await resetTestDatabase();
  setup = await adminWithTarget();
  vi.spyOn(email, "isSmtpConfigured").mockReturnValue(true);
  vi.spyOn(email, "sendAccountPasswordEmail").mockResolvedValue({
    success: true,
  });
  vi.spyOn(email, "sendEmailVerificationEmail").mockResolvedValue({
    success: true,
  });
});
afterEach(() => vi.unstubAllEnvs());

const post = (path: string, method = "POST") =>
  setup.asAdmin(`/${setup.target.userId}${path}`, { method });

async function auditRows(action: string) {
  return (await readAuditLog()).filter((row) => row.action === action);
}

async function targetVerified() {
  const [user] = await db
    .select({ emailVerified: schema.userTable.emailVerified })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, setup.target.userId));
  return user?.emailVerified;
}

describe("POST /api/admin/users/{userId}/password-reset-email", () => {
  it("emails a one-hour reset link without returning it", async () => {
    const response = await post("/password-reset-email");
    const text = await response.text();
    expect(response.status, text).toBe(200);
    expect(JSON.parse(text)).toEqual({ sent: true });

    const [to, subject, data] = vi.mocked(email.sendAccountPasswordEmail).mock
      .calls[0] as [
      string,
      EmailSubject,
      { purpose: string; passwordLink: string },
    ];
    expect(to).toBe("target@example.com");
    expect(typeof subject === "function" ? subject("Kaneo") : subject).toBe(
      "Choose a new Kaneo password",
    );
    expect(data.purpose).toBe("reset");
    const link = new URL(data.passwordLink);
    const token = link.pathname.split("/").at(-1);
    expect(text).not.toContain(token);

    const [verification] = await db.select().from(schema.verificationTable);
    const lifetime = (verification?.expiresAt.getTime() ?? 0) - Date.now();
    expect(lifetime).toBeGreaterThan(3_500_000);
    expect(lifetime).toBeLessThanOrEqual(3_600_000);

    const rows = await readAuditLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "user.password_reset_sent",
      actorUserId: setup.admin.userId,
      targetId: setup.target.userId,
      targetLabel: "target@example.com",
      metadata: null,
    });
    expect(JSON.stringify(rows)).not.toContain(token);

    const visit = await setup.app.request(data.passwordLink);
    expect(visit.status).toBe(302);
    const redirect = new URL(visit.headers.get("location") as string);
    expect(`${redirect.origin}${redirect.pathname}`).toBe(
      "http://localhost:5173/auth/reset-password",
    );
    expect(redirect.searchParams.get("token")).toBe(token);
    expect(redirect.searchParams.has("error")).toBe(false);
    const reset = await setup.app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        newPassword: "a fresh reset password 123",
      }),
    });
    expect(reset.status).toBe(200);
  });

  it("explains why nothing was sent and records nothing", async () => {
    vi.mocked(email.isSmtpConfigured).mockReturnValue(false);
    let response = await post("/password-reset-email");
    expect(response.status).toBe(503);
    expect((await readErrorBody(response)).code).toBe(
      "EMAIL_DELIVERY_NOT_CONFIGURED",
    );

    vi.mocked(email.isSmtpConfigured).mockReturnValue(true);
    vi.mocked(email.sendAccountPasswordEmail).mockRejectedValue(
      new Error("SMTP down"),
    );
    response = await post("/password-reset-email");
    expect(response.status).toBe(502);
    expect((await readErrorBody(response)).code).toBe("EMAIL_DELIVERY_FAILED");

    vi.stubEnv("DISABLE_LOGIN_FORM", "true");
    response = await post("/password-reset-email");
    expect(response.status).toBe(409);
    expect((await readErrorBody(response)).code).toBe(
      "PASSWORD_SIGN_IN_DISABLED",
    );

    expect(await readAuditLog()).toEqual([]);
  });

  it("refuses guest accounts", async () => {
    await db
      .update(schema.userTable)
      .set({ isAnonymous: true })
      .where(eq(schema.userTable.id, setup.target.userId));
    const response = await post("/password-reset-email");
    expect(response.status).toBe(409);
    expect((await readErrorBody(response)).code).toBe("GUEST_ACCOUNT");
    expect(email.sendAccountPasswordEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/users/{userId}/verification-email", () => {
  it("emails a link that verifies the address", async () => {
    const response = await post("/verification-email");
    const text = await response.text();
    expect(response.status, text).toBe(200);

    const [to, subject, data] = vi.mocked(email.sendEmailVerificationEmail).mock
      .calls[0] as [string, EmailSubject, { verificationLink: string }];
    expect(to).toBe("target@example.com");
    expect(typeof subject === "function" ? subject("Kaneo") : subject).toBe(
      "Confirm your email address for Kaneo",
    );
    const link = new URL(data.verificationLink);
    expect(text).not.toContain(link.searchParams.get("token"));
    expect(await auditRows("user.verification_sent")).toHaveLength(1);
    expect(await readAuditLog()).toHaveLength(1);

    const visit = await setup.app.request(data.verificationLink);
    expect(visit.status).toBe(302);
    expect(visit.headers.get("location")).toBe(
      "http://localhost:5173/auth/sign-in",
    );
    expect(await targetVerified()).toBe(true);
  });

  it("refuses an address that is already verified", async () => {
    await db
      .update(schema.userTable)
      .set({ emailVerified: true })
      .where(eq(schema.userTable.id, setup.target.userId));
    const response = await post("/verification-email");
    expect(response.status).toBe(409);
    expect((await readErrorBody(response)).code).toBe("EMAIL_ALREADY_VERIFIED");
    expect(email.sendEmailVerificationEmail).not.toHaveBeenCalled();
    expect(await readAuditLog()).toEqual([]);
  });

  it("does not record an email that was not sent", async () => {
    vi.mocked(email.isSmtpConfigured).mockReturnValue(false);
    expect((await post("/verification-email")).status).toBe(503);
    expect(await readAuditLog()).toEqual([]);
  });
});

describe("PUT /api/admin/users/{userId}/email-verified", () => {
  it("rejects all guest email actions without changing or auditing the account", async () => {
    await db
      .update(schema.userTable)
      .set({ isAnonymous: true })
      .where(eq(schema.userTable.id, setup.target.userId));

    for (const [path, method] of [
      ["/password-reset-email", "POST"],
      ["/verification-email", "POST"],
      ["/email-verified", "PUT"],
    ]) {
      const response = await post(path, method);
      expect(response.status, path).toBe(409);
      expect((await readErrorBody(response)).code).toBe("GUEST_ACCOUNT");
    }
    expect(await targetVerified()).toBe(false);
    expect(email.sendAccountPasswordEmail).not.toHaveBeenCalled();
    expect(email.sendEmailVerificationEmail).not.toHaveBeenCalled();
    expect(await readAuditLog()).toEqual([]);

    const response = await setup.asAdmin("");
    const body = (await response.json()) as {
      users: { id: string; isAnonymous: boolean }[];
    };
    expect(
      body.users.find((user) => user.id === setup.target.userId)?.isAnonymous,
    ).toBe(true);
    expect(
      body.users.find((user) => user.id === setup.admin.userId)?.isAnonymous,
    ).toBe(false);
  });

  it("marks the email verified once", async () => {
    expect(await targetVerified()).toBe(false);
    const first = await post("/email-verified", "PUT");
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ emailVerified: true });
    expect(await targetVerified()).toBe(true);

    expect((await post("/email-verified", "PUT")).status).toBe(200);
    const rows = await readAuditLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "user.email_verified",
      targetId: setup.target.userId,
      targetLabel: "target@example.com",
    });
  });
});
