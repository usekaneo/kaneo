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
      .calls[0] as [string, string, { purpose: string; passwordLink: string }];
    expect(to).toBe("target@example.com");
    expect(subject).toBe("Choose a new Kaneo password");
    expect(data.purpose).toBe("reset");
    const token = new URL(data.passwordLink).pathname.split("/").at(-1);
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
      .calls[0] as [string, string, { verificationLink: string }];
    expect(to).toBe("target@example.com");
    expect(subject).toBe("Confirm your email address for Kaneo");
    const link = new URL(data.verificationLink);
    expect(text).not.toContain(link.searchParams.get("token"));
    expect(await auditRows("user.verification_sent")).toHaveLength(1);
    expect(await readAuditLog()).toHaveLength(1);

    const visit = await setup.app.request(`${link.pathname}${link.search}`);
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
