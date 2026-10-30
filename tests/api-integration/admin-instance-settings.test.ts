import * as email from "@kaneo/email";
import { and, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { invalidateInstanceSettings } from "../../apps/api/src/instance-settings/get-instance-settings";
import { activeIntegrationCondition } from "../../apps/api/src/plugins/active-integration-condition";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import {
  insertInstanceRole,
  signInWithRole,
} from "./helpers/admin/instance-roles";
import { signInWithCustomOAuth } from "./helpers/custom-oauth";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import { createProjectFixture } from "./helpers/fixtures";

vi.hoisted(() => {
  process.env.CUSTOM_OAUTH_CLIENT_ID = "kaneo-test";
  process.env.CUSTOM_OAUTH_CLIENT_SECRET = "kaneo-test-secret";
  process.env.CUSTOM_OAUTH_AUTHORIZATION_URL =
    "https://idp.example.com/authorize";
  process.env.CUSTOM_OAUTH_TOKEN_URL = "https://idp.example.com/token";
});

const PASSWORD = "correct horse battery staple";
const json = {
  "content-type": "application/json",
  origin: "http://localhost:5173",
};

type App = ReturnType<typeof createApp>["app"];

function authPost(app: App, path: string, body: unknown, cookie?: string) {
  return app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { ...json, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function signUp(app: App, address: string) {
  return authPost(app, "/sign-up/email", {
    name: "New person",
    email: address,
    password: PASSWORD,
  });
}

async function userByEmail(address: string) {
  const [user] = await db
    .select()
    .from(schema.userTable)
    .where(eq(schema.userTable.email, address));
  return user;
}

/** An administrator, so later sign-ups are not the instance's first account. */
async function setUp() {
  const { app } = createApp();
  const admin = await signInWithRole(app, "admin");
  return { app, admin };
}

beforeEach(async () => {
  await resetTestDatabase();
  invalidateInstanceSettings();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("instance settings API", () => {
  it("returns today's behavior on a fresh install", async () => {
    const { admin } = await setUp();
    const response = await admin.api("/settings");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      instanceName: null,
      instanceUrl: "http://localhost:5173",
      registrationEnabled: true,
      passwordRegistrationEnabled: true,
      requireEmailVerification: false,
      defaultRole: "user",
      workspaceCreationRestricted: false,
      disabledIntegrations: [],
      lockedByEnv: [],
      emailDeliveryConfigured: false,
    });
    expect(await db.select().from(schema.instanceSettingsTable)).toEqual([]);
  });

  it("rejects users without instance:settings and API keys", async () => {
    const { app, admin } = await setUp();
    const plain = await signInWithRole(app, "user");
    expect((await plain.api("/settings")).status).toBe(403);
    expect(
      (
        await plain.api("/settings", {
          method: "PATCH",
          body: { instanceName: "X" },
        })
      ).status,
    ).toBe(403);

    const { key } = await auth.api.createApiKey({
      body: { userId: admin.userId, name: "Settings test" },
    });
    for (const headers of [
      { "x-api-key": key },
      { authorization: `Bearer ${key}` },
    ]) {
      const response = await app.request("/api/admin/settings", {
        method: "PATCH",
        headers: { ...json, ...headers },
        body: JSON.stringify({ registrationEnabled: false }),
      });
      expect(response.status).toBe(403);
    }
    expect(await readAuditLog()).toEqual([]);
  });

  it("saves changes, shows them in config, and audits only what changed", async () => {
    const { app, admin } = await setUp();
    const saved = await admin.api("/settings", {
      method: "PATCH",
      body: {
        instanceName: "  Acme Tasks ",
        passwordRegistrationEnabled: false,
        disabledIntegrations: ["slack", "slack", "discord"],
      },
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({
      instanceName: "Acme Tasks",
      passwordRegistrationEnabled: false,
      disabledIntegrations: ["discord", "slack"],
    });
    // Repeating the same values records nothing.
    await admin.api("/settings", {
      method: "PATCH",
      body: {
        instanceName: "Acme Tasks",
        disabledIntegrations: ["slack", "discord"],
      },
    });

    const config = (await (await app.request("/api/config")).json()) as Record<
      string,
      unknown
    >;
    expect(config).toMatchObject({
      instanceName: "Acme Tasks",
      disablePasswordRegistration: true,
      disabledIntegrations: ["discord", "slack"],
      hasGuestAccess: false,
    });

    const entries = await readAuditLog();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: "instance.settings_updated",
      targetType: "instance",
      actorUserId: admin.userId,
      metadata: {
        changes: [
          { setting: "instanceName", from: null, to: "Acme Tasks" },
          { setting: "passwordRegistrationEnabled", from: true, to: false },
          {
            setting: "disabledIntegrations",
            from: [],
            to: ["discord", "slack"],
          },
        ],
      },
    });
  });

  it("validates values", async () => {
    const { admin } = await setUp();
    const cases = [
      { body: {}, status: 400 },
      { body: { defaultRole: "admin" }, status: 400 },
      { body: { defaultRole: "missing" }, status: 400 },
      { body: { disabledIntegrations: ["jira"] }, status: 400 },
      { body: { requireEmailVerification: true }, status: 400 },
      { body: { instanceName: "x".repeat(61) }, status: 400 },
    ];
    for (const { body, status } of cases) {
      const response = await admin.api("/settings", { method: "PATCH", body });
      expect(response.status, JSON.stringify(body)).toBe(status);
    }
    expect(await readAuditLog()).toEqual([]);
  });

  it.each([
    ["DISABLE_REGISTRATION", "registrationEnabled", false],
    ["DISABLE_PASSWORD_REGISTRATION", "passwordRegistrationEnabled", false],
    ["DISABLE_WORKSPACE_CREATION", "workspaceCreationRestricted", true],
  ] as const)("lets %s lock %s", async (variable, setting, forced) => {
    const { admin } = await setUp();
    // A saved value does not override the environment.
    await admin.api("/settings", {
      method: "PATCH",
      body: { [setting]: !forced },
    });
    vi.stubEnv(variable, "true");

    const settings = (await (await admin.api("/settings")).json()) as Record<
      string,
      unknown
    >;
    expect(settings[setting]).toBe(forced);
    expect(settings.lockedByEnv).toEqual([setting]);

    const blocked = await admin.api("/settings", {
      method: "PATCH",
      body: { [setting]: !forced },
    });
    expect(blocked.status).toBe(409);
    expect(await readErrorBody(blocked)).toMatchObject({
      code: "SETTING_LOCKED_BY_ENV",
    });
  });
});

describe("registration settings", () => {
  it("closes registration to people without an invitation", async () => {
    const { app, admin } = await setUp();
    await admin.api("/settings", {
      method: "PATCH",
      body: { registrationEnabled: false },
    });
    const response = await signUp(app, "closed@example.com");
    expect(response.status).toBe(403);
    expect(await readErrorBody(response)).toMatchObject({
      code: "REGISTRATION_NOT_ALLOWED",
    });
    expect((await authPost(app, "/sign-in/anonymous", {})).status).toBe(403);
    expect(await userByEmail("closed@example.com")).toBeUndefined();
  });

  it("turns off password sign-up but keeps single sign-on", async () => {
    const { app, admin } = await setUp();
    await admin.api("/settings", {
      method: "PATCH",
      body: { passwordRegistrationEnabled: false },
    });
    expect((await signUp(app, "local@example.com")).status).toBe(403);
    expect(await userByEmail("local@example.com")).toBeUndefined();

    const callback = await signInWithCustomOAuth(app, {
      sub: "sso-1",
      email: "sso@example.com",
      email_verified: true,
      name: "SSO",
    });
    expect(callback.status).toBe(302);
    expect(await userByEmail("sso@example.com")).toBeDefined();
  });
});

describe("default role", () => {
  it("applies to password and OIDC sign-ups and admin-created users", async () => {
    const { app, admin } = await setUp();
    await insertInstanceRole("support", ["users:read"]);
    const saved = await admin.api("/settings", {
      method: "PATCH",
      body: { defaultRole: "support" },
    });
    expect(saved.status).toBe(200);

    expect((await signUp(app, "password@example.com")).status).toBe(200);
    expect((await userByEmail("password@example.com"))?.role).toBe("support");

    const callback = await signInWithCustomOAuth(app, {
      sub: "sso-2",
      email: "oidc@example.com",
      email_verified: true,
      name: "OIDC",
    });
    expect(callback.status).toBe(302);
    expect((await userByEmail("oidc@example.com"))?.role).toBe("support");

    const created = await admin.api("/users", {
      method: "POST",
      body: { name: "Created", email: "created@example.com" },
    });
    expect(created.status).toBe(201);
    expect((await userByEmail("created@example.com"))?.role).toBe("support");

    // An explicit role still wins.
    await admin.api("/users", {
      method: "POST",
      body: { name: "Plain", email: "plain@example.com", role: "user" },
    });
    expect((await userByEmail("plain@example.com"))?.role).toBe("user");
  });

  it("never applies to guests or the first account", async () => {
    const { app } = createApp();
    await db
      .insert(schema.instanceRoleTable)
      .values({ name: "support", permissions: [] });
    const [role] = await db.select().from(schema.instanceRoleTable);
    await db
      .insert(schema.instanceSettingsTable)
      .values({ defaultRoleId: role?.id });

    expect((await signUp(app, "first@example.com")).status).toBe(200);
    expect((await userByEmail("first@example.com"))?.role).toBe("admin");

    expect((await authPost(app, "/sign-in/anonymous", {})).status).toBe(200);
    const [guest] = await db
      .select({ role: schema.userTable.role })
      .from(schema.userTable)
      .where(eq(schema.userTable.isAnonymous, true));
    expect(guest?.role).toBe("user");
  });

  it("can't be a role with permissions the caller lacks", async () => {
    const { app } = await setUp();
    await insertInstanceRole("settings-only", ["instance:settings"]);
    await insertInstanceRole("deleter", ["users:delete"]);
    const manager = await signInWithRole(app, "settings-only");

    const blocked = await manager.api("/settings", {
      method: "PATCH",
      body: { defaultRole: "deleter" },
    });
    expect(blocked.status).toBe(403);
    expect(await readErrorBody(blocked)).toMatchObject({
      code: "ROLE_EXCEEDS_YOUR_PERMISSIONS",
    });
    const allowed = await manager.api("/settings", {
      method: "PATCH",
      body: { defaultRole: "settings-only" },
    });
    expect(allowed.status).toBe(200);
  });

  it("follows a rename and blocks deleting the role", async () => {
    const { admin } = await setUp();
    const role = await insertInstanceRole("support", []);
    await admin.api("/settings", {
      method: "PATCH",
      body: { defaultRole: "support" },
    });

    await admin.api(`/roles/${role?.id}`, {
      method: "PUT",
      body: { name: "help-desk", permissions: [] },
    });
    const settings = (await (await admin.api("/settings")).json()) as {
      defaultRole: string;
    };
    expect(settings.defaultRole).toBe("help-desk");

    const blocked = await admin.api(`/roles/${role?.id}`, { method: "DELETE" });
    expect(blocked.status).toBe(409);
    expect(await readErrorBody(blocked)).toMatchObject({
      code: "ROLE_IS_DEFAULT",
    });
  });
});

describe("email verification", () => {
  it("holds new password sign-ups back until the address is confirmed", async () => {
    vi.spyOn(email, "isSmtpConfigured").mockReturnValue(true);
    const sent = vi
      .spyOn(email, "sendEmailVerificationEmail")
      .mockResolvedValue({ success: true });
    const { app, admin } = await setUp();
    // Accounts from before the change keep signing in unverified.
    const existing = await signInWithRole(app, "user");
    const saved = await admin.api("/settings", {
      method: "PATCH",
      body: { requireEmailVerification: true },
    });
    expect(saved.status).toBe(200);

    const response = await signUp(app, "verify@example.com");
    expect(response.status).toBe(200);
    expect(((await response.json()) as { token: unknown }).token).toBeNull();
    expect(response.headers.getSetCookie().join(";")).not.toContain(
      "session_token=",
    );
    const user = await userByEmail("verify@example.com");
    expect(user).toMatchObject({
      emailVerified: false,
      emailVerificationRequired: true,
    });
    expect(
      await db
        .select()
        .from(schema.sessionTable)
        .where(eq(schema.sessionTable.userId, user?.id ?? "")),
    ).toEqual([]);
    expect(sent).toHaveBeenCalledTimes(1);
    const link = new URL(sent.mock.calls[0]?.[2].verificationLink ?? "");
    expect(link.pathname).toBe("/api/auth/verify-email");
    expect(link.searchParams.get("callbackURL")).toBe(
      "http://localhost:5173/auth/sign-in",
    );

    const signIn = await authPost(app, "/sign-in/email", {
      email: "verify@example.com",
      password: PASSWORD,
    });
    expect(signIn.status).toBe(403);
    expect(await readErrorBody(signIn)).toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    expect(sent).toHaveBeenCalledTimes(2);

    // A wrong password neither reveals the state nor sends a link.
    const wrong = await authPost(app, "/sign-in/email", {
      email: "verify@example.com",
      password: "not the password",
    });
    expect(wrong.status).toBe(401);
    expect(sent).toHaveBeenCalledTimes(2);

    const verified = await app.request(link.pathname + link.search);
    expect(verified.status).toBe(302);
    expect(
      (
        await authPost(app, "/sign-in/email", {
          email: "verify@example.com",
          password: PASSWORD,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await authPost(app, "/sign-in/email", {
          email: existing.email,
          password: PASSWORD,
        })
      ).status,
    ).toBe(200);
  });

  it("does not reveal existing accounts on sign-up", async () => {
    vi.spyOn(email, "isSmtpConfigured").mockReturnValue(true);
    vi.spyOn(email, "sendEmailVerificationEmail").mockResolvedValue({
      success: true,
    });
    const { app, admin } = await setUp();
    await admin.api("/settings", {
      method: "PATCH",
      body: { requireEmailVerification: true },
    });
    const response = await signUp(app, admin.email);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { token: unknown }).token).toBeNull();
  });

  it("lets marked accounts in once the setting is off", async () => {
    vi.spyOn(email, "isSmtpConfigured").mockReturnValue(true);
    vi.spyOn(email, "sendEmailVerificationEmail").mockResolvedValue({
      success: true,
    });
    const { app, admin } = await setUp();
    await admin.api("/settings", {
      method: "PATCH",
      body: { requireEmailVerification: true },
    });
    await signUp(app, "later@example.com");
    await admin.api("/settings", {
      method: "PATCH",
      body: { requireEmailVerification: false },
    });
    expect(
      (
        await authPost(app, "/sign-in/email", {
          email: "later@example.com",
          password: PASSWORD,
        })
      ).status,
    ).toBe(200);
  });
});

describe("workspace creation", () => {
  it("restricts creating workspaces to administrators", async () => {
    const { app, admin } = await setUp();
    await admin.api("/settings", {
      method: "PATCH",
      body: { workspaceCreationRestricted: true },
    });
    const member = await signInWithRole(app, "user");
    const create = (cookie: string, slug: string) =>
      authPost(app, "/organization/create", { name: "Team", slug }, cookie);

    expect((await create(member.cookies, "member-team")).status).toBe(403);
    expect((await create(admin.cookies, "admin-team")).status).toBe(200);
  });
});

describe("integration providers", () => {
  it("stop acting and can't be connected while turned off", async () => {
    const { app, admin } = await setUp();
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({
        id: "ws-int",
        name: "Int",
        slug: "ws-int",
        createdAt: new Date(),
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace?.id ?? "",
      userId: admin.userId,
      role: "owner",
      joinedAt: new Date(),
    });
    const { project } = await createProjectFixture({ workspaceId: "ws-int" });
    await db.insert(schema.integrationTable).values([
      { projectId: project.id, type: "slack", config: "{}" },
      { projectId: project.id, type: "discord", config: "{}" },
    ]);
    const activeTypes = async () =>
      (
        await db
          .select({ type: schema.integrationTable.type })
          .from(schema.integrationTable)
          .where(and(activeIntegrationCondition()))
      )
        .map((row) => row.type)
        .sort();
    expect(await activeTypes()).toEqual(["discord", "slack"]);

    await admin.api("/settings", {
      method: "PATCH",
      body: { disabledIntegrations: ["slack"] },
    });
    expect(await activeTypes()).toEqual(["discord"]);

    const slack = (method: string) =>
      app.request(`/api/slack-integration/project/${project.id}`, {
        method,
        headers: { ...json, cookie: admin.cookies },
        body:
          method === "GET" || method === "DELETE"
            ? undefined
            : JSON.stringify({}),
      });
    for (const method of ["POST", "PATCH"]) {
      const response = await slack(method);
      expect(response.status, method).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        code: "INTEGRATION_PROVIDER_DISABLED",
      });
    }
    expect((await slack("GET")).status).toBe(200);
    expect((await slack("DELETE")).status).not.toBe(403);
    // Other providers are untouched.
    const discord = await app.request(
      `/api/discord-integration/project/${project.id}`,
      {
        method: "PATCH",
        headers: { ...json, cookie: admin.cookies },
        body: JSON.stringify({}),
      },
    );
    expect(discord.status).not.toBe(403);

    // Sync rules and paused-link resumes write through the provider too.
    await admin.api("/settings", {
      method: "PATCH",
      body: { disabledIntegrations: ["slack", "github"] },
    });
    const sync = (method: string, suffix = "") =>
      app.request(
        `/api/integration-sync/project/${project.id}/github${suffix}`,
        {
          method,
          headers: { ...json, cookie: admin.cookies },
          body: method === "GET" ? undefined : JSON.stringify({}),
        },
      );
    for (const [method, suffix] of [
      ["PATCH", ""],
      ["POST", "/preview"],
      ["POST", "/links/link-1/resume"],
    ] as const) {
      const response = await sync(method, suffix);
      expect(response.status, `${method} ${suffix}`).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        code: "INTEGRATION_PROVIDER_DISABLED",
      });
    }
    expect((await sync("GET")).status).not.toBe(403);
    const gitea = await app.request(
      `/api/integration-sync/project/${project.id}/gitea`,
      {
        method: "PATCH",
        headers: { ...json, cookie: admin.cookies },
        body: JSON.stringify({}),
      },
    );
    expect(gitea.status).not.toBe(403);
  });
});
