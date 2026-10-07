import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
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
    await addMembership(twinB.id, caller.userId, "guest");
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
      expected(twinB, "guest"),
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
    expect(await response.text()).toContain("Unauthorized");
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
    const notMemberBody = await notMember.text();
    expect(notMemberBody).toContain("Workspace not found");
    expect(await missing.text()).toBe(notMemberBody);
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
    expect(await response.text()).toContain("Workspace not found");
  });

  it("rejects missing credentials", async () => {
    const { workspace } = await createWorkspaceMember();
    const { app } = createApp();

    const response = await app.request(`/api/workspace/${workspace.id}`);

    expect(response.status).toBe(401);
    expect(await response.text()).toContain("Unauthorized");
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
    expect(await response.text()).toContain("Unauthorized");
  });
});
