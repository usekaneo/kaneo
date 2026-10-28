import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import * as adminAudit from "../../apps/api/src/admin/audit/record-admin-action";
import db, { schema } from "../../apps/api/src/database";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { resetTestDatabase } from "./helpers/database";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

const smtp = vi.hoisted(() => ({
  configured: vi.fn(() => false),
  send: vi.fn(async () => ({ success: true })),
  verify: vi.fn(async () => ({ status: "not_configured" })),
}));

const redis = vi.hoisted(() => ({
  ping: vi.fn(async () => "PONG"),
}));

vi.mock("@kaneo/email", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isSmtpConfigured: smtp.configured,
  sendTestEmail: smtp.send,
  verifySmtpConnection: smtp.verify,
}));

// Keeps the real configuration parsing but never opens a Redis connection.
vi.mock("../../apps/api/src/redis", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRedisPub: () => ({ ping: redis.ping }),
  getRedisSub: () => ({ status: "ready" }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  smtp.configured.mockReset().mockReturnValue(false);
  smtp.send.mockReset().mockResolvedValue({ success: true });
  smtp.verify.mockReset().mockResolvedValue({ status: "not_configured" });
  redis.ping.mockReset().mockResolvedValue("PONG");
});

type SystemStatus = {
  version: string | null;
  api: { status: string; uptimeSeconds: number };
  database: {
    status: string;
    serverVersion: string | null;
    migrationsApplied: number | null;
  };
  realtime: { status: string; connections: number };
  redis: { status: string; mode: string | null; errorCode: string | null };
  email: { status: string; configured: boolean; errorCode: string | null };
  storage: { status: string; configured: boolean; errorCode: string | null };
  auth: {
    passwordSignIn: boolean;
    emailOtpSignIn: boolean;
    registration: boolean;
    providers: { id: string; name: string; status: string }[];
  };
  integrations: {
    type: string;
    status: string;
    requiresInstanceSetup: boolean;
    connectedProjects: number | null;
  }[];
};

async function withEnv<T>(
  values: Record<string, string>,
  run: () => Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function createAdminApiKey(userId: string) {
  const key = `test_${randomUUID()}`;
  await db.insert(schema.apikeyTable).values({
    referenceId: userId,
    userId,
    key: createHash("sha256").update(key).digest("base64url"),
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return key;
}

describe("admin system status", () => {
  it("requires a signed-in instance administrator session", async () => {
    mockAnonymousSession();
    expect((await projectAccessApi()("/admin/system")).status).toBe(401);
    expect(
      (await projectAccessApi()("/admin/system/test-email", { method: "POST" }))
        .status,
    ).toBe(401);

    const ctx = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.owner);
    smtp.configured.mockReturnValue(true);
    expect((await projectAccessApi()("/admin/system")).status).toBe(403);
    expect(
      (await projectAccessApi()("/admin/system/test-email", { method: "POST" }))
        .status,
    ).toBe(403);
    expect(smtp.send).not.toHaveBeenCalled();
    expect(await readAuditLog()).toEqual([]);
  });

  it("rejects API keys even when they belong to an administrator", async () => {
    const admin = await createInstanceAdmin();
    const key = await createAdminApiKey(admin.id);
    mockAnonymousSession();
    smtp.configured.mockReturnValue(true);
    const request = projectAccessApi({ "x-api-key": key });

    expect((await request("/admin/system")).status).toBe(403);
    expect(
      (await request("/admin/system/test-email", { method: "POST" })).status,
    ).toBe(403);
    expect(smtp.send).not.toHaveBeenCalled();
    expect(await readAuditLog()).toEqual([]);
  });

  it("reports each service, treating optional ones as not configured", async () => {
    const ctx = await createRestrictedWorkspace();
    const activeProject = ctx.alpha;
    const inactiveProject = ctx.beta;
    await db.insert(schema.integrationTable).values([
      { projectId: activeProject.id, type: "gitea", config: "{}" },
      {
        projectId: inactiveProject.id,
        type: "gitea",
        config: "{}",
        isActive: false,
      },
      { projectId: inactiveProject.id, type: "slack", config: "{}" },
    ]);
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi()("/admin/system");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as SystemStatus;
    const rootPackage = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    expect(body.version).toBe(rootPackage.version);
    expect(body.api.status).toBe("ok");
    expect(body.api.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.database.status).toBe("ok");
    expect(body.database.serverVersion).toMatch(/^\d+/);
    expect(body.database.migrationsApplied).toBeGreaterThan(0);
    expect(body.redis).toEqual({
      status: "not_configured",
      mode: null,
      errorCode: null,
    });
    expect(body.realtime.connections).toBe(0);
    expect(body.email).toEqual({
      status: "not_configured",
      configured: false,
      errorCode: null,
    });
    expect(body.storage).toEqual({
      status: "not_configured",
      configured: false,
      errorCode: null,
    });
    expect(body.auth.passwordSignIn).toBe(true);
    expect(body.auth.registration).toBe(true);
    expect(body.auth.providers.map((provider) => provider.id)).toEqual([
      "github",
      "google",
      "discord",
      "custom",
    ]);
    expect(
      body.auth.providers.every(
        (provider) => provider.status === "not_configured",
      ),
    ).toBe(true);

    const integrations = new Map(
      body.integrations.map((provider) => [provider.type, provider]),
    );
    expect(integrations.get("gitea")).toMatchObject({
      status: "ok",
      requiresInstanceSetup: false,
      connectedProjects: 1,
    });
    expect(integrations.get("slack")?.connectedProjects).toBe(1);
    expect(integrations.get("github")).toMatchObject({
      status: "not_configured",
      requiresInstanceSetup: true,
      connectedProjects: 0,
    });
  });

  it("never returns configured secrets, and reports unreachable services as down", async () => {
    const secrets = {
      GOOGLE_CLIENT_ID: "google-client-id-value",
      GOOGLE_CLIENT_SECRET: "google-secret-value",
      DISCORD_CLIENT_ID: "discord-client-id-value",
      GITHUB_OAUTH_CLIENT_ID: "github-oauth-id-value",
      GITHUB_OAUTH_CLIENT_SECRET: "github-oauth-secret-value",
      CUSTOM_OAUTH_CLIENT_ID: "oidc-client-id-value",
      CUSTOM_OAUTH_CLIENT_SECRET: "oidc-secret-value",
      CUSTOM_OAUTH_DISCOVERY_URL:
        "https://oidc-user:oidc-url-password@idp.example.test/.well-known/openid-configuration",
      CUSTOM_OAUTH_NAME: "Company SSO",
      GITHUB_APP_ID: "424242",
      GITHUB_WEBHOOK_SECRET: "github-webhook-secret-value",
      GITHUB_PRIVATE_KEY: "github-private-key-value",
      REDIS_URL: "redis://:redis-password-value@redis.internal.test:6379",
      S3_ENDPOINT: "http://127.0.0.1:1",
      S3_BUCKET: "private-bucket-name",
      S3_ACCESS_KEY_ID: "s3-access-key-value",
      S3_SECRET_ACCESS_KEY: "s3-secret-value",
    };
    smtp.configured.mockReturnValue(true);
    smtp.verify.mockResolvedValue({ status: "failed", code: "EAUTH" });
    redis.ping.mockRejectedValue(
      Object.assign(
        new Error(
          "connect ECONNREFUSED redis://:redis-password-value@redis.internal.test",
        ),
        { code: "ECONNREFUSED" },
      ),
    );
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await withEnv(secrets, () =>
      projectAccessApi()("/admin/system"),
    );

    expect(response.status).toBe(200);
    const text = await response.text();
    for (const [name, value] of Object.entries(secrets)) {
      if (name === "CUSTOM_OAUTH_NAME" || name === "GITHUB_APP_ID") continue;
      expect(text, name).not.toContain(value);
    }
    expect(text).not.toContain("redis.internal.test");
    expect(text).not.toContain("idp.example.test");
    expect(text).not.toContain("127.0.0.1");

    const body = JSON.parse(text) as SystemStatus;
    expect(body.redis).toEqual({
      status: "down",
      mode: "standalone",
      errorCode: "ECONNREFUSED",
    });
    expect(body.realtime.status).not.toBe("ok");
    expect(body.email).toEqual({
      status: "down",
      configured: true,
      errorCode: "EAUTH",
    });
    expect(body.storage).toMatchObject({ status: "down", configured: true });
    expect(body.database.status).toBe("ok");
    const providers = new Map(
      body.auth.providers.map((provider) => [provider.id, provider]),
    );
    expect(providers.get("google")?.status).toBe("ok");
    expect(providers.get("github")?.status).toBe("ok");
    expect(providers.get("discord")?.status).toBe("warning");
    expect(providers.get("custom")).toEqual({
      id: "custom",
      name: "Company SSO",
      status: "ok",
    });
    expect(
      body.integrations.find((provider) => provider.type === "github")?.status,
    ).toBe("ok");
  });
  it("reports an unreadable OIDC secret as a warning without failing the page", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await withEnv(
      {
        CUSTOM_OAUTH_CLIENT_ID: "oidc-client",
        CUSTOM_OAUTH_CLIENT_SECRET: "",
        CUSTOM_OAUTH_CLIENT_SECRET_FILE: "/missing-kaneo-oidc-secret",
        CUSTOM_OAUTH_DISCOVERY_URL: "https://idp.example.test/discovery",
      },
      () => projectAccessApi()("/admin/system"),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SystemStatus;
    expect(
      body.auth.providers.find((provider) => provider.id === "custom")?.status,
    ).toBe("warning");
  });

  it("reports email sign-in codes only when the login form can use them", async () => {
    smtp.configured.mockReturnValue(true);
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const auth = async () =>
      (
        (await (
          await projectAccessApi()("/admin/system")
        ).json()) as SystemStatus
      ).auth;

    expect((await auth()).emailOtpSignIn).toBe(true);
    const hidden = await withEnv({ DISABLE_LOGIN_FORM: "true" }, auth);
    expect(hidden).toMatchObject({
      passwordSignIn: false,
      emailOtpSignIn: false,
    });
  });
});

describe("admin test email", () => {
  it("explains that SMTP is not configured without trying to send", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi()("/admin/system/test-email", {
      method: "POST",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "SMTP_NOT_CONFIGURED",
    });
    expect(smtp.send).not.toHaveBeenCalled();
    expect(await readAuditLog()).toEqual([]);
  });

  it("only sends to the calling administrator and records exactly one audit entry", async () => {
    smtp.configured.mockReturnValue(true);
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi({
      "user-agent": "email-audit-agent",
    })("/admin/system/test-email", {
      method: "POST",
      body: { to: "someone-else@example.com", email: "victim@example.com" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true, to: admin.email });
    expect(smtp.send).toHaveBeenCalledTimes(1);
    expect(smtp.send.mock.calls[0]?.[0]).toBe(admin.email);
    const calls = JSON.stringify(smtp.send.mock.calls);
    expect(calls).not.toContain("someone-else@");
    expect(calls).not.toContain("victim@");

    const rows = await readAuditLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "email.test_sent",
      actorUserId: admin.id,
      actorName: admin.name,
      actorEmail: admin.email,
      targetType: "user",
      targetId: admin.id,
      targetLabel: admin.email,
      metadata: null,
      userAgent: "email-audit-agent",
    });
    expect(JSON.stringify(rows)).not.toContain("someone-else@");
    expect(JSON.stringify(rows)).not.toContain("victim@");
  });

  it("reports an accepted email as sent when its audit insert fails", async () => {
    smtp.configured.mockReturnValue(true);
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    vi.spyOn(adminAudit, "recordAdminAction").mockRejectedValue(
      new Error("query parameters contain private-audit-value"),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await projectAccessApi()("/admin/system/test-email", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true, to: admin.email });
    expect(smtp.send).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "Admin audit entry could not be recorded:",
      {
        action: "email.test_sent",
        code: "UNKNOWN",
      },
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-audit-value");
  });

  it("returns a safe error when the mail server rejects the message", async () => {
    smtp.configured.mockReturnValue(true);
    smtp.send.mockRejectedValue(
      Object.assign(
        new Error(
          "535 Authentication failed for smtp-user:smtp-password-value",
        ),
        { code: "EAUTH", responseCode: 535 },
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi()("/admin/system/test-email", {
      method: "POST",
    });

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).toContain("EAUTH 535");
    expect(text).not.toContain("smtp-password-value");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "smtp-password-value",
    );
    expect(await readAuditLog()).toEqual([]);
  });

  it("does not record an audit entry when delivery reports no success", async () => {
    smtp.configured.mockReturnValue(true);
    smtp.send.mockResolvedValue({ success: false });
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi()("/admin/system/test-email", {
      method: "POST",
    });

    expect(response.status).toBe(409);
    expect(smtp.send).toHaveBeenCalledTimes(1);
    expect(await readAuditLog()).toEqual([]);
  });

  it("limits how often one administrator can send", async () => {
    smtp.configured.mockReturnValue(true);
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const request = projectAccessApi();

    for (let attempt = 0; attempt < 5; attempt++) {
      expect(
        (await request("/admin/system/test-email", { method: "POST" })).status,
      ).toBe(200);
    }
    const rowsBeforeLimit = await readAuditLog();
    expect(rowsBeforeLimit).toHaveLength(5);
    expect(
      rowsBeforeLimit.every((row) => row.action === "email.test_sent"),
    ).toBe(true);
    const limited = await request("/admin/system/test-email", {
      method: "POST",
    });

    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await limited.json()).toMatchObject({ code: "RATE_LIMITED" });
    expect(smtp.send).toHaveBeenCalledTimes(5);
    expect(await readAuditLog()).toEqual(rowsBeforeLimit);
  });
});
