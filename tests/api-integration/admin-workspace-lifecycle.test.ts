import * as billing from "../../apps/api/src/billing/controllers/find-billable-workspaces";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  addConnection,
  addUserConnection,
  removeConnection,
  removeUserConnection,
} from "../../apps/api/src/ws";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

beforeEach(resetTestDatabase);

async function workspaceFixture() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
    workspaceName: "Lifecycle workspace",
  });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  return { owner, workspace, project };
}

async function readWorkspace(workspaceId: string) {
  const [row] = await db
    .select()
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, workspaceId));
  return row;
}

function fakeSocket() {
  return { send: vi.fn(), close: vi.fn() };
}

function sentMessages(socket: ReturnType<typeof fakeSocket>) {
  return socket.send.mock.calls.map(([message]) => JSON.parse(message));
}

const routes = (workspaceId: string) => [
  { path: `/admin/workspaces/${workspaceId}/archive`, method: "POST" },
  { path: `/admin/workspaces/${workspaceId}/restore`, method: "POST" },
  { path: `/admin/workspaces/${workspaceId}`, method: "DELETE" },
];

describe("admin workspace lifecycle authorization", () => {
  it("rejects anonymous callers and non-administrators", async () => {
    const { owner, workspace } = await workspaceFixture();

    for (const route of routes(workspace.id)) {
      mockAnonymousSession();
      expect(
        (await projectAccessApi()(route.path, { method: route.method })).status,
      ).toBe(401);
      vi.restoreAllMocks();

      mockAuthenticatedSession(owner);
      expect(
        (await projectAccessApi()(route.path, { method: route.method })).status,
      ).toBe(403);
      vi.restoreAllMocks();
    }

    expect((await readWorkspace(workspace.id))?.archivedAt).toBeNull();
    expect(await readAuditLog()).toEqual([]);
  });

  it("rejects an administrator's API key", async () => {
    const { workspace } = await workspaceFixture();
    const admin = await createInstanceAdmin();
    const { key } = await auth.api.createApiKey({
      body: { userId: admin.id, name: "Lifecycle test" },
    });
    const { app } = createApp();

    for (const route of routes(workspace.id)) {
      for (const headers of [
        { "x-api-key": key },
        { authorization: `Bearer ${key}` },
      ]) {
        const response = await app.request(`/api${route.path}`, {
          method: route.method,
          headers,
        });
        expect(response.status).toBe(403);
      }
    }

    expect(await readWorkspace(workspace.id)).toBeDefined();
    expect(await readAuditLog()).toEqual([]);
  });

  it("returns 404 for an unknown workspace", async () => {
    mockAuthenticatedSession(await createInstanceAdmin());
    for (const route of routes("missing-workspace")) {
      expect(
        (await projectAccessApi()(route.path, { method: route.method })).status,
      ).toBe(404);
    }
  });
});

describe("archiving and restoring a workspace", () => {
  it("archives once, revokes realtime access, and records one audit entry", async () => {
    const { owner, workspace, project } = await workspaceFixture();
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const userSocket = fakeSocket();
    const boardSocket = fakeSocket();
    const userConnection = addUserConnection(
      owner.id,
      userSocket as unknown as WSContext,
    );
    const boardConnection = addConnection(
      project.id,
      boardSocket as unknown as WSContext,
      owner.id,
      "window",
      workspace.id,
    );

    try {
      const response = await projectAccessApi()(
        `/admin/workspaces/${workspace.id}/archive`,
        { method: "POST" },
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        id: string;
        archivedAt: string;
      };
      expect(body.id).toBe(workspace.id);
      expect(Date.parse(body.archivedAt)).not.toBeNaN();

      expect(boardSocket.close).toHaveBeenCalledWith(
        1008,
        "Workspace archived",
      );
      expect(sentMessages(userSocket)).toContainEqual({
        type: "WORKSPACE_ACCESS_REVOKED",
        workspaceId: workspace.id,
        reason: "archived",
      });
    } finally {
      removeUserConnection(owner.id, userConnection);
      removeConnection(project.id, boardConnection);
    }

    const stored = await readWorkspace(workspace.id);
    expect(stored?.archivedAt).toBeInstanceOf(Date);
    expect(stored?.archivedBy).toBe(admin.id);

    const again = await projectAccessApi()(
      `/admin/workspaces/${workspace.id}/archive`,
      { method: "POST" },
    );
    expect(again.status).toBe(409);
    expect(((await again.json()) as { code: string }).code).toBe(
      "WORKSPACE_ALREADY_ARCHIVED",
    );

    const entries = await readAuditLog();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: "workspace.archived",
      actorUserId: admin.id,
      targetType: "workspace",
      targetId: workspace.id,
      targetLabel: "Lifecycle workspace",
      metadata: { slug: workspace.slug },
    });
  });

  it("lists the archive state and who archived it", async () => {
    const { workspace } = await workspaceFixture();
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const request = projectAccessApi();

    await request(`/admin/workspaces/${workspace.id}/archive`, {
      method: "POST",
    });
    const list = await request("/admin/workspaces");
    expect(list.status).toBe(200);
    const { workspaces } = (await list.json()) as {
      workspaces: {
        id: string;
        archivedAt: string | null;
        archivedBy: { id: string; name: string; email: string } | null;
      }[];
    };
    expect(workspaces).toEqual([
      expect.objectContaining({
        id: workspace.id,
        archivedAt: expect.any(String),
        archivedBy: { id: admin.id, name: admin.name, email: admin.email },
      }),
    ]);
  });

  it("restores access, tells open clients, and records one audit entry", async () => {
    const { owner, workspace } = await workspaceFixture();
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const request = projectAccessApi();

    const notArchived = await request(
      `/admin/workspaces/${workspace.id}/restore`,
      { method: "POST" },
    );
    expect(notArchived.status).toBe(409);
    expect(((await notArchived.json()) as { code: string }).code).toBe(
      "WORKSPACE_NOT_ARCHIVED",
    );

    await request(`/admin/workspaces/${workspace.id}/archive`, {
      method: "POST",
    });
    const userSocket = fakeSocket();
    const userConnection = addUserConnection(
      owner.id,
      userSocket as unknown as WSContext,
    );
    try {
      const restored = await request(
        `/admin/workspaces/${workspace.id}/restore`,
        { method: "POST" },
      );
      expect(restored.status).toBe(200);
      expect(await restored.json()).toEqual({
        id: workspace.id,
        archivedAt: null,
      });
      expect(sentMessages(userSocket)).toContainEqual({
        type: "WORKSPACE_RESTORED",
        workspaceId: workspace.id,
      });
    } finally {
      removeUserConnection(owner.id, userConnection);
    }

    const stored = await readWorkspace(workspace.id);
    expect(stored?.archivedAt).toBeNull();
    expect(stored?.archivedBy).toBeNull();

    vi.restoreAllMocks();
    mockAuthenticatedSession(owner);
    const projects = await projectAccessApi()(
      `/project?workspaceId=${workspace.id}`,
    );
    expect(projects.status).toBe(200);

    expect((await readAuditLog()).map((entry) => entry.action)).toEqual([
      "workspace.archived",
      "workspace.restored",
    ]);
  });
});

describe("deleting a workspace", () => {
  it("removes the workspace and its data, queues its files, and records one audit entry", async () => {
    const { owner, workspace, project } = await workspaceFixture();
    const other = await workspaceFixture();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Doomed task",
        number: 1,
        status: "to-do",
      })
      .returning();
    const objectKey = `uploads/${randomUUID()}`;
    await db.insert(schema.assetTable).values({
      workspaceId: workspace.id,
      projectId: project.id,
      taskId: task.id,
      objectKey,
      filename: "file.png",
      mimeType: "image/png",
      size: 3,
      surface: "description",
      createdBy: owner.id,
    });
    const backgroundKey = `backgrounds/${randomUUID()}`;
    await db
      .update(schema.projectTable)
      .set({ backgroundObjectKey: backgroundKey })
      .where(eq(schema.projectTable.id, project.id));
    await db.insert(schema.invitationTable).values({
      workspaceId: workspace.id,
      inviterId: owner.id,
      email: "invitee@example.com",
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const userSocket = fakeSocket();
    const userConnection = addUserConnection(
      owner.id,
      userSocket as unknown as WSContext,
    );
    try {
      const response = await projectAccessApi()(
        `/admin/workspaces/${workspace.id}`,
        { method: "DELETE" },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: workspace.id });
      expect(sentMessages(userSocket)).toContainEqual({
        type: "WORKSPACE_ACCESS_REVOKED",
        workspaceId: workspace.id,
      });
    } finally {
      removeUserConnection(owner.id, userConnection);
    }

    expect(await readWorkspace(workspace.id)).toBeUndefined();
    const projectsLeft = await db
      .select({ id: schema.projectTable.id })
      .from(schema.projectTable);
    expect(projectsLeft).toEqual([{ id: other.project.id }]);
    expect(
      await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.id, task.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.invitationTable)
        .where(eq(schema.invitationTable.workspaceId, workspace.id)),
    ).toEqual([]);
    const queued = await db
      .select({ objectKey: schema.storageCleanupTable.objectKey })
      .from(schema.storageCleanupTable);
    expect(queued.map((row) => row.objectKey).sort()).toEqual(
      [objectKey, backgroundKey].sort(),
    );
    // The owner's account stays.
    expect(
      await db
        .select({ id: schema.userTable.id })
        .from(schema.userTable)
        .where(eq(schema.userTable.id, owner.id)),
    ).toHaveLength(1);

    const entries = await readAuditLog();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: "workspace.deleted",
      actorUserId: admin.id,
      targetId: workspace.id,
      targetLabel: "Lifecycle workspace",
      metadata: {
        slug: workspace.slug,
        memberCount: 1,
        projectCount: 1,
        wasArchived: false,
      },
    });
  });

  it("keeps subscribed workspaces and their audit history unchanged", async () => {
    const { workspace } = await workspaceFixture();
    mockAuthenticatedSession(await createInstanceAdmin());
    vi.spyOn(billing, "findBillableWorkspaces").mockResolvedValue([
      { workspaceId: workspace.id, name: workspace.name },
    ]);
    const response = await projectAccessApi()(
      `/admin/workspaces/${workspace.id}`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "WORKSPACE_HAS_ACTIVE_SUBSCRIPTION",
    });
    expect(await readWorkspace(workspace.id)).toBeDefined();
    expect(await readAuditLog()).toEqual([]);
  });

  it("preserves the native owner's key authentication and consumes its request quota", async () => {
    const { owner, workspace } = await workspaceFixture();
    const { key, id } = await auth.api.createApiKey({
      body: { userId: owner.id, name: "Owner deletion" },
    });
    const { app } = createApp();
    const response = await app.request("/api/auth/organization/delete", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify({ organizationId: workspace.id }),
    });
    expect(response.status).toBe(200);
    expect(await readWorkspace(workspace.id)).toBeUndefined();
    const [stored] = await db
      .select()
      .from(schema.apikeyTable)
      .where(eq(schema.apikeyTable.id, id));
    expect(stored.requestCount).toBe(1);
  });

  it("retains native deletion permissions and the subscription guard", async () => {
    const { owner, workspace } = await workspaceFixture();
    const outsider = await createWorkspaceMember();
    const { app } = createApp();
    const call = (key: string) =>
      app.request("/api/auth/organization/delete", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key },
        body: JSON.stringify({ organizationId: workspace.id }),
      });
    const denied = await auth.api.createApiKey({
      body: { userId: outsider.user.id },
    });
    expect((await call(denied.key)).status).toBe(403);
    const allowed = await auth.api.createApiKey({ body: { userId: owner.id } });
    vi.spyOn(billing, "findBillableWorkspaces").mockResolvedValue([
      { workspaceId: workspace.id, name: workspace.name },
    ]);
    const response = await call(allowed.key);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "WORKSPACE_HAS_ACTIVE_SUBSCRIPTION",
    });
    expect(await readWorkspace(workspace.id)).toBeDefined();
  });

  it("deletes an archived workspace", async () => {
    const { workspace } = await workspaceFixture();
    mockAuthenticatedSession(await createInstanceAdmin());
    const request = projectAccessApi();

    await request(`/admin/workspaces/${workspace.id}/archive`, {
      method: "POST",
    });
    const response = await request(`/admin/workspaces/${workspace.id}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    expect(await readWorkspace(workspace.id)).toBeUndefined();
    const deleted = (await readAuditLog()).find(
      (entry) => entry.action === "workspace.deleted",
    );
    expect(deleted?.metadata).toMatchObject({ wasArchived: true });
  });

  it("queues the workspace's files when its owner deletes it too", async () => {
    const { app } = createApp();
    const signup = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner-delete@example.test",
        password: "correct horse battery staple",
        name: "Owner",
      }),
    });
    expect(signup.status).toBe(200);
    const cookie = signup.headers
      .getSetCookie()
      .map((entry) => entry.split(";")[0])
      .join("; ");
    const created = await app.request("/api/auth/organization/create", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Owned", slug: `owned-${randomUUID()}` }),
    });
    expect(created.status).toBe(200);
    const workspace = (await created.json()) as { id: string };
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const objectKey = `uploads/${randomUUID()}`;
    await db.insert(schema.assetTable).values({
      workspaceId: workspace.id,
      projectId: project.id,
      objectKey,
      filename: "file.png",
      mimeType: "image/png",
      size: 3,
      surface: "description",
    });

    const deleted = await app.request("/api/auth/organization/delete", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ organizationId: workspace.id }),
    });
    expect(deleted.status).toBe(200);
    expect(await readWorkspace(workspace.id)).toBeUndefined();
    expect(
      await db
        .select({ objectKey: schema.storageCleanupTable.objectKey })
        .from(schema.storageCleanupTable),
    ).toEqual([{ objectKey }]);
  });
});
