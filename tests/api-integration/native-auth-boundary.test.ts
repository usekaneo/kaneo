import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";

type Permissions = Record<string, string[]>;
type App = ReturnType<typeof createApp>["app"];

// Notification delivery is covered separately. Keep its background handlers
// from racing the database resets in this native authorization suite.
vi.mock("../../apps/api/src/events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/api/src/events")>()),
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(resetTestDatabase);

async function fixture() {
  const { app } = createApp();
  const owner = await signUpWithSession(app, {
    email: "owner@example.com",
    name: "Owner",
    role: "user",
  });
  const viewer = await signUpWithSession(app, {
    email: "viewer@example.com",
    name: "Viewer",
    role: "user",
  });
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      name: "Private workspace",
      slug: randomUUID(),
      createdAt: new Date(),
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values([
    {
      workspaceId: workspace.id,
      userId: owner.userId,
      role: "owner",
      joinedAt: new Date(),
    },
    {
      workspaceId: workspace.id,
      userId: viewer.userId,
      role: "limited",
      joinedAt: new Date(),
    },
  ]);
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId: workspace.id,
    role: "limited",
    permission: "{}",
  });
  const [invitation] = await db
    .insert(schema.invitationTable)
    .values({
      workspaceId: workspace.id,
      inviterId: owner.userId,
      email: "invitee@example.com",
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  const sessions = await db.select().from(schema.sessionTable);
  const ownerToken = sessions.find(
    (session) => session.userId === owner.userId,
  )!.token;
  const viewerToken = sessions.find(
    (session) => session.userId === viewer.userId,
  )!.token;
  return { app, owner, viewer, workspace, invitation, ownerToken, viewerToken };
}

async function keyFor(
  app: App,
  cookies: string,
  permissions: Permissions | null,
) {
  const response = await app.request("/api/auth/api-key/create", {
    method: "POST",
    headers: { cookie: cookies, "content-type": "application/json" },
    body: JSON.stringify({ name: "Boundary regression" }),
  });
  expect(response.status).toBe(200);
  const key = (await response.json()) as { id: string; key: string };
  // Permissions are a server-only provider property. Narrow the actual key
  // after normal credential creation rather than mocking provider validation.
  await db
    .update(schema.apikeyTable)
    .set({
      rateLimitEnabled: false,
      ...(permissions !== null
        ? { permissions: JSON.stringify(permissions) }
        : {}),
    })
    .where(eq(schema.apikeyTable.id, key.id));
  return key;
}

function keyHeaders(key: string, bearer: boolean, cookies?: string) {
  return {
    ...(bearer ? { authorization: `bEaReR ${key}` } : { "x-api-key": key }),
    ...(cookies ? { cookie: cookies } : {}),
    "content-type": "application/json",
  };
}

describe("native auth credential boundary", () => {
  it.each([null, { label: ["read"] }] as (Permissions | null)[])(
    "keeps scoped and legacy keys out of account, session and admin management (%j)",
    async (permissions) => {
      const { app, owner, viewer, ownerToken } = await fixture();
      await db
        .update(schema.userTable)
        .set({ role: "admin" })
        .where(eq(schema.userTable.id, owner.userId));
      const key = await keyFor(app, owner.cookies, permissions);
      const sessionIds = (await db.select().from(schema.sessionTable))
        .map((row) => row.id)
        .sort();
      const keyIds = (await db.select().from(schema.apikeyTable))
        .map((row) => row.id)
        .sort();
      const operations = [
        { path: "/api-key/create", body: { name: "Escaped" } },
        { path: "/api-key/list", method: "GET" },
        { path: `/api-key/get?id=${key.id}`, method: "GET" },
        { path: "/api-key/update", body: { keyId: key.id, name: "Changed" } },
        { path: "/api-key/delete", body: { keyId: key.id } },
        { path: "/list-sessions", method: "GET" },
        { path: "/revoke-session", body: { token: ownerToken } },
        { path: "/revoke-sessions", body: {} },
        { path: "/revoke-other-sessions", body: {} },
        { path: "/update-user", body: { name: "Changed" } },
        { path: "/change-email", body: { newEmail: "changed@example.com" } },
        {
          path: "/change-password",
          body: {
            currentPassword: "correct horse battery staple",
            newPassword: "another long password",
          },
        },
        { path: "/get-access-token", body: { providerId: "custom" } },
        { path: "/admin/impersonate-user", body: { userId: viewer.userId } },
        {
          path: "/admin/create-user",
          body: {
            email: "created@example.com",
            name: "Created",
            password: "another long password",
          },
        },
        { path: "/admin/remove-user", body: { userId: viewer.userId } },
        { path: "/device/approve", body: { userCode: "ABCD-EFGH" } },
      ];
      for (const bearer of [false, true]) {
        for (const cookies of [undefined, owner.cookies]) {
          for (const operation of operations) {
            const response = await app.request(`/api/auth${operation.path}`, {
              method: operation.method ?? "POST",
              headers: keyHeaders(key.key, bearer, cookies),
              ...(operation.body
                ? { body: JSON.stringify(operation.body) }
                : {}),
            });
            expect(
              response.status,
              `${operation.path}, bearer=${bearer}, cookie=${Boolean(cookies)}`,
            ).toBe(403);
            expect(await response.json()).toMatchObject({
              code: "SESSION_REQUIRED",
            });
          }
        }
      }
      expect(
        (await db.select().from(schema.sessionTable))
          .map((row) => row.id)
          .sort(),
      ).toEqual(sessionIds);
      expect(
        (await db.select().from(schema.apikeyTable))
          .map((row) => row.id)
          .sort(),
      ).toEqual(keyIds);
      expect(
        await db.query.userTable.findFirst({
          where: eq(schema.userTable.id, owner.userId),
        }),
      ).toMatchObject({ name: "Owner" });
      expect(
        await db.query.userTable.findFirst({
          where: eq(schema.userTable.id, viewer.userId),
        }),
      ).toBeDefined();
    },
  );

  it.each([null, { label: ["read"] }] as (Permissions | null)[])(
    "returns only the virtual key session with a valid cookie (%j)",
    async (permissions) => {
      const { app, owner, viewer, ownerToken, viewerToken } = await fixture();
      const key = await keyFor(app, owner.cookies, permissions);
      for (const bearer of [false, true]) {
        const response = await app.request("/api/auth/get-session", {
          headers: keyHeaders(key.key, bearer, viewer.cookies),
        });
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        const body = await response.json();
        expect(body).toMatchObject({
          user: { id: owner.userId },
          session: { id: key.id, token: key.key },
        });
        expect(JSON.stringify(body)).not.toContain(ownerToken);
        expect(JSON.stringify(body)).not.toContain(viewerToken);
      }
    },
  );

  it("checks the actual slug/active workspace and the key owner's current role", async () => {
    const { app, owner, viewer, workspace, viewerToken } = await fixture();
    const [readable] = await db
      .insert(schema.workspaceTable)
      .values({
        name: "Readable",
        slug: randomUUID(),
        createdAt: new Date(),
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: readable.id,
      userId: viewer.userId,
      role: "owner",
      joinedAt: new Date(),
    });
    await db
      .update(schema.sessionTable)
      .set({ activeOrganizationId: workspace.id })
      .where(eq(schema.sessionTable.userId, viewer.userId));
    for (const operation of ["get-full-organization", "list-members"]) {
      const response = await app.request(
        `/api/auth/organization/${operation}?organizationId=${readable.id}&organizationSlug=${workspace.slug}`,
        {
          headers: { authorization: `Bearer ${viewerToken}` },
        },
      );
      expect(response.status).toBe(403);
    }
    const active = await app.request(
      `/api/auth/organization/get-active-member?organizationId=${readable.id}`,
      {
        headers: { cookie: viewer.cookies },
      },
    );
    expect(active.status).toBe(403);
    for (const permissions of [
      null,
      { workspace: ["read"] },
    ] as (Permissions | null)[]) {
      const key = await keyFor(app, viewer.cookies, permissions);
      const response = await app.request(
        `/api/auth/organization/get-full-organization?organizationId=${workspace.id}`,
        {
          headers: keyHeaders(key.key, true, owner.cookies),
        },
      );
      expect(response.status).toBe(403);
    }
  });

  it("preserves real bearer and cookie credential management and native admin session issuance", async () => {
    const { app, owner, viewer, ownerToken } = await fixture();
    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, owner.userId));
    for (const headers of [
      { cookie: owner.cookies },
      { authorization: `bEaReR ${ownerToken}` },
    ]) {
      const created = await app.request("/api/auth/api-key/create", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ name: "Real session" }),
      });
      expect(created.status).toBe(200);
      const sessions = await app.request("/api/auth/list-sessions", {
        headers,
      });
      expect(sessions.status).toBe(200);
      const impersonation = await app.request(
        "/api/auth/admin/impersonate-user",
        {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ userId: viewer.userId }),
        },
      );
      expect(impersonation.status).toBe(200);
      expect(await impersonation.json()).toMatchObject({
        user: { id: viewer.userId },
      });
    }
  });
});

describe("native organization scope and current workspace grants", () => {
  it("batches list grants without bypassing current workspace roles for instance admins", async () => {
    const { app, viewer, workspace } = await fixture();
    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, viewer.userId));
    const [fallback, multi, demoted, nonmember] = await db
      .insert(schema.workspaceTable)
      .values(
        ["Fallback", "Multi", "Demoted", "Nonmember"].map((name) => ({
          name,
          slug: randomUUID(),
          createdAt: new Date(),
        })),
      )
      .returning();
    await db.insert(schema.workspaceUserTable).values([
      {
        workspaceId: fallback.id,
        userId: viewer.userId,
        role: "member",
        joinedAt: new Date(),
      },
      {
        workspaceId: multi.id,
        userId: viewer.userId,
        role: "limited,reader",
        joinedAt: new Date(),
      },
      {
        workspaceId: demoted.id,
        userId: viewer.userId,
        role: "admin",
        joinedAt: new Date(),
      },
    ]);
    await db.insert(schema.workspaceRoleTable).values([
      { workspaceId: multi.id, role: "limited", permission: "{}" },
      {
        workspaceId: multi.id,
        role: "reader",
        permission: JSON.stringify({ workspace: ["read"] }),
      },
      { workspaceId: demoted.id, role: "admin", permission: "{}" },
    ]);
    const list = async () => {
      const response = await app.request("/api/auth/organization/list", {
        headers: { cookie: viewer.cookies },
      });
      expect(response.status).toBe(200);
      return ((await response.json()) as { id: string }[])
        .map((row) => row.id)
        .sort();
    };
    expect(await list()).toEqual([fallback.id, multi.id].sort());
    for (const id of [workspace.id, demoted.id, nonmember.id]) {
      expect(
        (
          await app.request(
            `/api/auth/organization/get-full-organization?organizationId=${id}`,
            {
              headers: { cookie: viewer.cookies },
            },
          )
        ).status,
      ).toBe(403);
    }
    await db
      .update(schema.workspaceRoleTable)
      .set({ permission: "{}" })
      .where(eq(schema.workspaceRoleTable.workspaceId, multi.id));
    expect(await list()).toEqual([fallback.id]);
  });

  it.each([false, true])(
    "denies limited roles through IDs, slugs and active workspace (bearer=%s)",
    async (bearer) => {
      const { app, viewer, viewerToken, workspace } = await fixture();
      const headers = bearer
        ? { authorization: `Bearer ${viewerToken}` }
        : { cookie: viewer.cookies };
      await db
        .update(schema.sessionTable)
        .set({ activeOrganizationId: workspace.id })
        .where(eq(schema.sessionTable.userId, viewer.userId));
      for (const operation of [
        "get-full-organization",
        "list-members",
        "get-active-member",
      ]) {
        for (const query of [
          "",
          `?organizationId=${workspace.id}`,
          `?organizationSlug=${workspace.slug}`,
        ]) {
          const response = await app.request(
            `/api/auth/organization/${operation}${query}`,
            { headers },
          );
          expect(response.status, operation + query).toBe(403);
        }
      }
      const list = await app.request("/api/auth/organization/list", {
        headers,
      });
      expect(list.status).toBe(200);
      expect(await list.json()).toEqual([]);
      for (const suffix of ["capabilities", "project-access/me"]) {
        const discovery = await app.request(
          `/api/workspace/${workspace.id}/${suffix}`,
          { headers },
        );
        expect(discovery.status).toBe(200);
      }
      await db
        .update(schema.workspaceRoleTable)
        .set({ permission: JSON.stringify({ workspace: ["read"] }) })
        .where(eq(schema.workspaceRoleTable.workspaceId, workspace.id));
      const allowed = await app.request(
        `/api/auth/organization/get-full-organization?organizationId=${workspace.id}`,
        { headers },
      );
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toMatchObject({
        id: workspace.id,
        invitations: [],
      });
    },
  );

  it.each([false, true])(
    "enforces organization key scopes with a valid cookie present (bearer=%s)",
    async (bearer) => {
      const { app, owner, viewer, workspace, invitation } = await fixture();
      const limited = await keyFor(app, owner.cookies, { label: ["read"] });
      const reader = await keyFor(app, owner.cookies, { workspace: ["read"] });
      const inviter = await keyFor(app, owner.cookies, {
        invitation: ["create"],
      });
      const legacy = await keyFor(app, owner.cookies, null);
      for (const cookies of [undefined, viewer.cookies]) {
        for (const operation of [
          "get-full-organization",
          "list-members",
          "list-invitations",
        ]) {
          const response = await app.request(
            `/api/auth/organization/${operation}?organizationId=${workspace.id}`,
            {
              headers: keyHeaders(limited.key, bearer, cookies),
            },
          );
          expect(response.status).toBe(403);
          expect(await response.text()).not.toContain(invitation.id);
        }
        const full = await app.request(
          `/api/auth/organization/get-full-organization?organizationId=${workspace.id}`,
          {
            headers: keyHeaders(reader.key, bearer, cookies),
          },
        );
        expect(full.status).toBe(200);
        expect(await full.json()).toMatchObject({
          id: workspace.id,
          invitations: [],
        });
        const invitations = await app.request(
          `/api/auth/organization/list-invitations?organizationId=${workspace.id}`,
          {
            headers: keyHeaders(inviter.key, bearer, cookies),
          },
        );
        expect(invitations.status).toBe(200);
        expect(await invitations.json()).toEqual([
          expect.objectContaining({ id: invitation.id }),
        ]);
        const legacyFull = await app.request(
          `/api/auth/organization/get-full-organization?organizationId=${workspace.id}`,
          {
            headers: keyHeaders(legacy.key, bearer, cookies),
          },
        );
        expect(legacyFull.status).toBe(200);
        expect(await legacyFull.json()).toMatchObject({
          invitations: [expect.objectContaining({ id: invitation.id })],
        });
      }
      const { project } = await createProjectFixture({
        workspaceId: workspace.id,
      });
      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          title: "Key task",
          number: 1,
          status: "to-do",
        })
        .returning();
      const taskKey = await keyFor(app, owner.cookies, { task: ["read"] });
      expect(
        (
          await app.request(`/api/task/${task.id}`, {
            headers: keyHeaders(taskKey.key, bearer),
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await app.request(`/api/task/${task.id}`, {
            headers: keyHeaders(limited.key, bearer, owner.cookies),
          })
        ).status,
      ).toBe(403);
    },
  );

  it("requires native mutation scopes and retains CLI invitation/update operations", async () => {
    const { app, owner, workspace, invitation } = await fixture();
    const limited = await keyFor(app, owner.cookies, { label: ["read"] });
    const inviter = await keyFor(app, owner.cookies, {
      invitation: ["create"],
    });
    const editor = await keyFor(app, owner.cookies, {
      organization: ["update"],
    });
    const operations = [
      {
        path: "invite-member",
        body: {
          organizationId: workspace.id,
          email: "other@example.com",
          role: "member",
        },
      },
      {
        path: "update",
        body: { organizationId: workspace.id, data: { name: "Updated" } },
      },
      { path: "cancel-invitation", body: { invitationId: invitation.id } },
      {
        path: "update-member-role",
        body: {
          organizationId: workspace.id,
          memberId: "unknown",
          role: "admin",
        },
      },
      { path: "create", body: { name: "Escaped", slug: "escaped" } },
    ] as const;
    for (const operation of operations) {
      const response = await app.request(
        `/api/auth/organization/${operation.path}`,
        {
          method: "POST",
          headers: keyHeaders(limited.key, false, owner.cookies),
          body: JSON.stringify(operation.body),
        },
      );
      expect(response.status).toBe(403);
    }
    for (const [key, operation] of [
      [inviter, operations[0]],
      [editor, operations[1]],
    ] as const) {
      const response = await app.request(
        `/api/auth/organization/${operation.path}`,
        {
          method: "POST",
          headers: keyHeaders(key.key, true, owner.cookies),
          body: JSON.stringify(operation.body),
        },
      );
      expect(response.status).toBe(200);
    }
    const legacy = await keyFor(app, owner.cookies, null);
    const created = await app.request("/api/auth/organization/create", {
      method: "POST",
      headers: keyHeaders(legacy.key, false),
      body: JSON.stringify({
        name: "CLI workspace",
        slug: "cli-workspace",
        keepCurrentActiveOrganization: true,
      }),
    });
    expect(created.status).toBe(200);
  });

  it("keeps stored owner-resend checks for bearer sessions and scoped inviter keys", async () => {
    const {
      app,
      owner,
      viewer,
      viewerToken,
      ownerToken,
      workspace,
      invitation,
    } = await fixture();
    await db
      .update(schema.workspaceRoleTable)
      .set({ permission: JSON.stringify({ invitation: ["create"] }) })
      .where(eq(schema.workspaceRoleTable.workspaceId, workspace.id));
    await db
      .update(schema.invitationTable)
      .set({ role: "member,owner" })
      .where(eq(schema.invitationTable.id, invitation.id));
    const key = await keyFor(app, viewer.cookies, { invitation: ["create"] });
    const body = {
      organizationId: workspace.id,
      email: invitation.email,
      role: "member",
      resend: true,
    };
    for (const headers of [
      {
        authorization: `Bearer ${viewerToken}`,
        "content-type": "application/json",
      },
      keyHeaders(key.key, false, owner.cookies),
      keyHeaders(key.key, true, owner.cookies),
    ]) {
      const response = await app.request(
        "/api/auth/organization/invite-member",
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        },
      );
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain(invitation.id);
      expect(
        await db.query.invitationTable.findFirst({
          where: eq(schema.invitationTable.id, invitation.id),
        }),
      ).toMatchObject({ expiresAt: invitation.expiresAt });
    }
    const ownerResend = await app.request(
      "/api/auth/organization/invite-member",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...body, role: "member,owner" }),
      },
    );
    expect(ownerResend.status).toBe(200);
  });
});
