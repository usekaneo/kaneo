import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import { createWorkspaceMember } from "./helpers/fixtures";

type WorkspaceRow = typeof schema.workspaceTable.$inferSelect;

async function createWorkspace(
  values: Partial<Omit<WorkspaceRow, "id" | "slug">> & { id?: string } = {},
) {
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: values.id ?? `workspace-${randomUUID()}`,
      name: values.name ?? "Workspace",
      slug: `workspace-${randomUUID()}`,
      logo: values.logo ?? null,
      description: values.description ?? null,
      metadata: values.metadata ?? null,
      createdAt: values.createdAt ?? new Date(),
    })
    .returning();
  return workspace;
}

async function addMembership(
  workspaceId: string,
  userId: string,
  role: string,
  joinedAt = new Date(),
) {
  await db
    .insert(schema.workspaceUserTable)
    .values({ workspaceId, userId, role, joinedAt });
}

async function addRole(
  workspaceId: string,
  role: string,
  permission: Record<string, string[]>,
) {
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId,
    role,
    permission: JSON.stringify(permission),
  });
}

function expected(workspace: WorkspaceRow, role: string | null) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    logo: workspace.logo,
    description: workspace.description,
    createdAt: workspace.createdAt.toISOString(),
    role,
  };
}

const workspaceNotFound = {
  message: "Workspace not found",
  code: "NOT_FOUND",
};

const unauthorized = { message: "Unauthorized", code: "UNAUTHORIZED" };

async function readJson(response: Response) {
  expect(response.status).toBe(200);
  const body = (await response.json()) as unknown;
  const items = Array.isArray(body) ? body : [body];
  for (const item of items) {
    expect(item).not.toHaveProperty("metadata");
  }
  return body;
}

describe("GET /api/workspace", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists only the caller's workspaces with their role, sorted by name", async () => {
    const { app } = createApp();
    const caller = await signUpWithSession(app, {
      email: "caller@example.com",
      name: "Caller",
    });
    const beta = await createWorkspace({ name: "beta" });
    const alpha = await createWorkspace({ name: "Alpha" });
    const charlie = await createWorkspace({ name: "Charlie" });
    const twinB = await createWorkspace({ id: "workspace-b", name: "Twin" });
    const twinA = await createWorkspace({ id: "workspace-a", name: "twin" });
    await addMembership(beta.id, caller.userId, "owner");
    await addMembership(alpha.id, caller.userId, "member");
    await addMembership(charlie.id, caller.userId, "admin");
    await addMembership(twinB.id, caller.userId, "viewer");
    await addMembership(twinA.id, caller.userId, "member");
    await createWorkspaceMember({ workspaceName: "Aardvark" });

    const response = await app.request("/api/workspace", {
      headers: { cookie: caller.cookies },
    });

    expect(await readJson(response)).toEqual([
      expected(alpha, "member"),
      expected(beta, "owner"),
      expected(charlie, "admin"),
      expected(twinA, "member"),
      expected(twinB, "viewer"),
    ]);
  });

  it("lists a workspace once when the caller has a duplicate membership row", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    await addMembership(
      workspace.id,
      user.id,
      "member",
      new Date(Date.now() + 60_000),
    );
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/workspace");

    expect(await readJson(response)).toEqual([expected(workspace, "owner")]);
  });

  it("only lists an instance admin's own memberships", async () => {
    await createWorkspaceMember({ workspaceName: "Someone else's" });
    const admin = await createInstanceAdmin();
    const joined = await createWorkspace({ name: "Joined" });
    await addMembership(joined.id, admin.id, "member");
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    const response = await app.request("/api/workspace");

    expect(await readJson(response)).toEqual([expected(joined, "member")]);
  });

  it("leaves out workspaces where the caller's role lacks workspace:read", async () => {
    const { user, workspace: hidden } = await createWorkspaceMember({
      role: "limited",
      workspaceName: "Hidden",
    });
    await addRole(hidden.id, "limited", { task: ["read"] });
    const edited = await createWorkspace({ name: "Edited viewer" });
    await addMembership(edited.id, user.id, "viewer");
    await addRole(edited.id, "viewer", { project: ["read"] });
    const custom = await createWorkspace({ name: "Custom" });
    await addMembership(custom.id, user.id, "reader");
    await addRole(custom.id, "reader", { workspace: ["read"] });
    const visible = await createWorkspace({ name: "Visible" });
    await addMembership(visible.id, user.id, "member");
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/workspace");

    expect(await readJson(response)).toEqual([
      expected(custom, "reader"),
      expected(visible, "member"),
    ]);
  });

  it("lists and reads a workspace when any of the caller's roles grants workspace:read", async () => {
    const { user, workspace: custom } = await createWorkspaceMember({
      role: "limited,reader",
      workspaceName: "Custom",
    });
    await addRole(custom.id, "limited", { task: ["read"] });
    await addRole(custom.id, "reader", { workspace: ["read"] });
    const builtIn = await createWorkspace({ name: "Built-in" });
    await addMembership(builtIn.id, user.id, "limited, viewer");
    await addRole(builtIn.id, "limited", { task: ["read"] });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const list = await app.request("/api/workspace");
    const customSingle = await app.request(`/api/workspace/${custom.id}`);
    const builtInSingle = await app.request(`/api/workspace/${builtIn.id}`);

    expect(await readJson(list)).toEqual([
      expected(builtIn, "limited, viewer"),
      expected(custom, "limited,reader"),
    ]);
    expect(await readJson(customSingle)).toEqual(
      expected(custom, "limited,reader"),
    );
    expect(await readJson(builtInSingle)).toEqual(
      expected(builtIn, "limited, viewer"),
    );
  });

  it("hides a workspace when none of the caller's roles grants workspace:read", async () => {
    const { user, workspace } = await createWorkspaceMember({
      role: "limited,other",
    });
    await addRole(workspace.id, "limited", { task: ["read"] });
    await addRole(workspace.id, "other", { project: ["read"] });
    await addRole(workspace.id, "reader", { workspace: ["read"] });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const list = await app.request("/api/workspace");
    const single = await app.request(`/api/workspace/${workspace.id}`);

    expect(await readJson(list)).toEqual([]);
    expect(single.status).toBe(404);
    expect(await readErrorBody(single)).toEqual(workspaceNotFound);
  });

  it("grants access when any duplicate role row grants workspace:read", async () => {
    const { user, workspace: readFirst } = await createWorkspaceMember({
      role: "custom",
      workspaceName: "Read first",
    });
    await addRole(readFirst.id, "custom", { workspace: ["read"] });
    await addRole(readFirst.id, "custom", { task: ["read"] });
    const readLast = await createWorkspace({ name: "Read last" });
    await addMembership(readLast.id, user.id, "custom");
    await addRole(readLast.id, "custom", { task: ["read"] });
    await addRole(readLast.id, "custom", { workspace: ["read"] });
    const noRead = await createWorkspace({ name: "No read" });
    await addMembership(noRead.id, user.id, "custom");
    await addRole(noRead.id, "custom", { task: ["read"] });
    await addRole(noRead.id, "custom", { project: ["read"] });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const list = await app.request("/api/workspace");
    const first = await app.request(`/api/workspace/${readFirst.id}`);
    const last = await app.request(`/api/workspace/${readLast.id}`);
    const denied = await app.request(`/api/workspace/${noRead.id}`);

    expect(await readJson(list)).toEqual([
      expected(readFirst, "custom"),
      expected(readLast, "custom"),
    ]);
    expect(await readJson(first)).toEqual(expected(readFirst, "custom"));
    expect(await readJson(last)).toEqual(expected(readLast, "custom"));
    expect(denied.status).toBe(404);
  });

  it("lists an instance admin's membership even when the role lacks workspace:read", async () => {
    const admin = await createInstanceAdmin();
    const workspace = await createWorkspace({ name: "Limited" });
    await addMembership(workspace.id, admin.id, "limited");
    await addRole(workspace.id, "limited", { task: ["read"] });
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    const list = await app.request("/api/workspace");
    const single = await app.request(`/api/workspace/${workspace.id}`);

    expect(await readJson(list)).toEqual([expected(workspace, "limited")]);
    expect(await readJson(single)).toEqual(expected(workspace, "limited"));
  });

  it("returns an empty list when the caller has no workspaces", async () => {
    await createWorkspaceMember();
    const { app } = createApp();
    const caller = await signUpWithSession(app, {
      email: "lonely@example.com",
      name: "Lonely",
    });

    const response = await app.request("/api/workspace", {
      headers: { cookie: caller.cookies },
    });

    expect(await readJson(response)).toEqual([]);
  });

  it("rejects missing credentials", async () => {
    const { app } = createApp();

    const response = await app.request("/api/workspace");

    expect(response.status).toBe(401);
    expect(await readErrorBody(response)).toEqual(unauthorized);
  });
});

describe("GET /api/workspace/{workspaceId}", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("returns the workspace with exactly the documented fields", async () => {
    const { app } = createApp();
    const caller = await signUpWithSession(app, {
      email: "member@example.com",
      name: "Member",
    });
    const workspace = await createWorkspace({
      name: "Product",
      logo: "https://example.com/logo.png",
      description: "Where the roadmap lives",
      metadata: JSON.stringify({ description: "Older text", secret: "x" }),
    });
    await addMembership(workspace.id, caller.userId, "admin");

    const response = await app.request(`/api/workspace/${workspace.id}`, {
      headers: { cookie: caller.cookies },
    });

    expect(await readJson(response)).toEqual(expected(workspace, "admin"));
  });

  it("falls back to the description stored in metadata", async () => {
    const { user } = await createWorkspaceMember();
    const workspace = await createWorkspace({
      metadata: JSON.stringify({ description: "From metadata" }),
    });
    await addMembership(workspace.id, user.id, "member");
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(`/api/workspace/${workspace.id}`);

    expect(await readJson(response)).toEqual({
      ...expected(workspace, "member"),
      description: "From metadata",
    });
  });

  it("returns null for a missing or unreadable description", async () => {
    const { user } = await createWorkspaceMember();
    const workspace = await createWorkspace({
      description: "  ",
      metadata: "{not json",
    });
    await addMembership(workspace.id, user.id, "member");
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(`/api/workspace/${workspace.id}`);

    expect(await readJson(response)).toEqual({
      ...expected(workspace, "member"),
      description: null,
    });
  });

  it("returns the earliest membership role when the caller has duplicate rows", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    await addMembership(
      workspace.id,
      user.id,
      "member",
      new Date(Date.now() + 60_000),
    );
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(`/api/workspace/${workspace.id}`);

    expect(await readJson(response)).toEqual(expected(workspace, "owner"));
  });

  it("returns the same 404 for a non-member and a nonexistent workspace", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const notMember = await app.request(`/api/workspace/${workspace.id}`);
    const missing = await app.request("/api/workspace/workspace-missing");

    expect(notMember.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await readErrorBody(notMember)).toEqual(workspaceNotFound);
    expect(await readErrorBody(missing)).toEqual(workspaceNotFound);
  });

  it("returns the same 404 when the caller's role lacks workspace:read", async () => {
    const { user, workspace } = await createWorkspaceMember({
      role: "limited",
    });
    await addRole(workspace.id, "limited", { task: ["read"] });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const denied = await app.request(`/api/workspace/${workspace.id}`);
    const missing = await app.request("/api/workspace/workspace-missing");

    expect(denied.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await readErrorBody(denied)).toEqual(workspaceNotFound);
    expect(await readErrorBody(missing)).toEqual(workspaceNotFound);
  });

  it("lets an instance admin read a workspace they are not a member of", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    const response = await app.request(`/api/workspace/${workspace.id}`);

    expect(await readJson(response)).toEqual(expected(workspace, null));
  });

  it("returns 404 to an instance admin for a nonexistent workspace", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    const response = await app.request("/api/workspace/workspace-missing");

    expect(response.status).toBe(404);
    expect(await readErrorBody(response)).toEqual(workspaceNotFound);
  });

  it("rejects missing credentials", async () => {
    const { workspace } = await createWorkspaceMember();
    const { app } = createApp();

    const response = await app.request(`/api/workspace/${workspace.id}`);

    expect(response.status).toBe(401);
    expect(await readErrorBody(response)).toEqual(unauthorized);
  });
});

describe("workspace endpoints with bearer credentials", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it.each(["Authorization", "x-api-key"])(
    "accepts an API key in %s",
    async (header) => {
      await createWorkspaceMember({ workspaceName: "Not mine" });
      const { user, workspace } = await createWorkspaceMember({
        role: "owner",
      });
      const { key } = await auth.api.createApiKey({
        body: { userId: user.id, name: "Workspace endpoints test" },
      });
      const headers = {
        [header]: header === "Authorization" ? `Bearer ${key}` : key,
      };
      const { app } = createApp();

      const list = await app.request("/api/workspace", { headers });
      const single = await app.request(`/api/workspace/${workspace.id}`, {
        headers,
      });

      expect(await readJson(list)).toEqual([expected(workspace, "owner")]);
      expect(await readJson(single)).toEqual(expected(workspace, "owner"));
    },
  );

  it("rejects an API key without workspace:read on both routes", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { key } = await auth.api.createApiKey({
      body: {
        userId: user.id,
        name: "Task reader",
        permissions: { task: ["read"], project: ["read"] },
      },
    });
    const headers = { Authorization: `Bearer ${key}` };
    const { app } = createApp();

    const list = await app.request("/api/workspace", { headers });
    const single = await app.request(`/api/workspace/${workspace.id}`, {
      headers,
    });

    const scopeError = {
      message: "Insufficient API key scope",
      code: "API_KEY_SCOPE",
      missingPermissions: ["workspace:read"],
    };
    expect(list.status).toBe(403);
    expect(await readErrorBody(list)).toEqual(scopeError);
    expect(single.status).toBe(403);
    expect(await readErrorBody(single)).toEqual(scopeError);
  });

  it("accepts an API key scoped to workspace:read", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { key } = await auth.api.createApiKey({
      body: {
        userId: user.id,
        name: "Workspace reader",
        permissions: { workspace: ["read"] },
      },
    });
    const headers = { "x-api-key": key };
    const { app } = createApp();

    const list = await app.request("/api/workspace", { headers });
    const single = await app.request(`/api/workspace/${workspace.id}`, {
      headers,
    });

    expect(await readJson(list)).toEqual([expected(workspace, "owner")]);
    expect(await readJson(single)).toEqual(expected(workspace, "owner"));
  });

  it("reads the instance admin role from the database for API keys", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    const admin = await createInstanceAdmin();
    const { key } = await auth.api.createApiKey({
      body: { userId: admin.id, name: "Admin key" },
    });
    const { app } = createApp();

    const response = await app.request(`/api/workspace/${workspace.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });

    expect(await readJson(response)).toEqual(expected(workspace, null));
  });

  it("accepts a session token as a bearer token", async () => {
    const { app } = createApp();
    const caller = await signUpWithSession(app, {
      email: "bearer@example.com",
      name: "Bearer",
    });
    const workspace = await createWorkspace({ name: "Bearer workspace" });
    await addMembership(workspace.id, caller.userId, "member");
    const signIn = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "bearer@example.com",
        password: "correct horse battery staple",
      }),
    });
    const token = signIn.headers.get("set-auth-token");
    expect(token).toBeTruthy();

    const response = await app.request("/api/workspace", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(await readJson(response)).toEqual([expected(workspace, "member")]);
  });

  it("rejects an invalid API key", async () => {
    const { app } = createApp();

    const response = await app.request("/api/workspace", {
      headers: { "x-api-key": "invalid-key" },
    });

    expect(response.status).toBe(401);
    expect(await readErrorBody(response)).toEqual(unauthorized);
  });
});
