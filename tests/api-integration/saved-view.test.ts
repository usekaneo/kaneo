import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type SavedViewPayload = {
  workspaceId: string;
  projectId?: string | null;
  userId?: string | null;
  key: string;
  name: string;
  type: "board" | "list" | "gantt";
  position: number;
  enabled: boolean;
  configuration: Record<string, unknown>;
};

async function createUserInWorkspace(workspaceId: string, role = "member") {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id,
      email: `${id}@example.com`,
      emailVerified: true,
      name: "Saved View Test User",
    })
    .returning();

  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });

  return user;
}

async function hashApiKeyForTest(key: string) {
  const hash = createHash("sha256").update(key).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function upsertSavedView(
  app: ReturnType<typeof createApp>["app"],
  payload: SavedViewPayload,
) {
  return app.request("/api/saved-view", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("API integration: saved views", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("resolves workspace, project, and personal layers without leaking personal settings", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const otherUser = await createUserInWorkspace(admin.workspace.id);
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const base = {
      workspaceId: admin.workspace.id,
      key: "tasks",
      enabled: true,
    } as const;
    for (const payload of [
      {
        ...base,
        name: "Workspace tasks",
        type: "board" as const,
        position: 30,
        configuration: { resultDensity: "comfortable", compact: false },
      },
      {
        ...base,
        projectId: project.id,
        name: "Project tasks",
        type: "list" as const,
        position: 20,
        configuration: {
          resultDensity: "compact",
          compact: true,
          groupBy: "status",
        },
      },
      {
        ...base,
        projectId: project.id,
        userId: admin.user.id,
        name: "My tasks",
        type: "gantt" as const,
        position: 10,
        configuration: { groupBy: "assignee" },
      },
    ]) {
      const response = await upsertSavedView(app, payload);
      expect(response.status).toBe(200);
    }

    const personalResponse = await app.request(
      `/api/saved-view/workspace/${admin.workspace.id}/project/${project.id}`,
    );
    expect(personalResponse.status).toBe(200);
    await expect(personalResponse.json()).resolves.toEqual([
      expect.objectContaining({
        key: "tasks",
        name: "My tasks",
        type: "gantt",
        position: 10,
        enabled: true,
        configuration: {
          resultDensity: "compact",
          compact: true,
          groupBy: "assignee",
        },
      }),
    ]);

    mockAuthenticatedSession(otherUser);
    const { app: otherApp } = createApp();
    const sharedResponse = await otherApp.request(
      `/api/saved-view/workspace/${admin.workspace.id}/project/${project.id}`,
    );
    expect(sharedResponse.status).toBe(200);
    await expect(sharedResponse.json()).resolves.toEqual([
      expect.objectContaining({
        key: "tasks",
        name: "Project tasks",
        type: "list",
        position: 20,
        enabled: true,
        configuration: {
          resultDensity: "compact",
          compact: true,
          groupBy: "status",
        },
      }),
    ]);
  });

  it("allows a member to write a personal view but rejects shared writes", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const payload = {
      workspaceId: member.workspace.id,
      projectId: project.id,
      key: "mine",
      name: "Mine",
      type: "board" as const,
      position: 0,
      enabled: true,
      configuration: {},
    };

    const sharedResponse = await upsertSavedView(app, payload);
    expect(sharedResponse.status).toBe(403);

    const personalResponse = await upsertSavedView(app, {
      ...payload,
      userId: member.user.id,
    });
    expect(personalResponse.status).toBe(200);
  });

  it("rejects a personal write through a read-only API key", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const rawKey = `kaneo_test_${randomUUID()}`;
    const now = new Date();
    await db.insert(schema.apikeyTable).values({
      referenceId: member.user.id,
      userId: member.user.id,
      key: await hashApiKeyForTest(rawKey),
      name: "saved view read-only key",
      permissions: JSON.stringify({ saved_view: ["read"] }),
      createdAt: now,
      updatedAt: now,
    });
    const { app } = createApp();

    const response = await app.request("/api/saved-view", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${rawKey}`,
      },
      body: JSON.stringify({
        workspaceId: member.workspace.id,
        projectId: project.id,
        userId: member.user.id,
        key: "mine",
        name: "Mine",
        type: "board",
        position: 0,
        enabled: true,
        configuration: {},
      }),
    });

    expect(response.status).toBe(403);
    expect(await db.query.savedViewTable.findMany()).toHaveLength(0);
  });

  it("rejects another user's personal scope", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const otherUser = await createUserInWorkspace(member.workspace.id);
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await upsertSavedView(app, {
      workspaceId: member.workspace.id,
      userId: otherUser.id,
      key: "mine",
      name: "Mine",
      type: "list",
      position: 0,
      enabled: true,
      configuration: {},
    });

    expect(response.status).toBe(403);
    expect(await db.query.savedViewTable.findMany()).toHaveLength(0);
  });

  it("rejects a project from another workspace", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const otherWorkspace = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: otherWorkspace.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await upsertSavedView(app, {
      workspaceId: admin.workspace.id,
      projectId: project.id,
      key: "cross-tenant",
      name: "Cross tenant",
      type: "board",
      position: 0,
      enabled: true,
      configuration: {},
    });

    expect(response.status).toBe(400);
    expect(await db.query.savedViewTable.findMany()).toHaveLength(0);
  });

  it("rejects listing a project from another workspace", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const otherWorkspace = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: otherWorkspace.workspace.id,
    });
    await db.insert(schema.savedViewTable).values({
      workspaceId: member.workspace.id,
      key: "private-workspace",
      name: "Private workspace",
      type: "board",
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/saved-view/workspace/${member.workspace.id}/project/${project.id}`,
    );

    expect(response.status).toBe(400);
  });

  it("updates the same nullable scope instead of inserting a duplicate", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();
    const payload = {
      workspaceId: admin.workspace.id,
      projectId: null,
      userId: null,
      key: "overview",
      name: "  Overview  ",
      type: "board" as const,
      position: 2,
      enabled: true,
      configuration: { groupBy: "status" },
    };

    expect((await upsertSavedView(app, payload)).status).toBe(200);
    const updatedResponse = await upsertSavedView(app, {
      ...payload,
      name: "  Updated overview  ",
      position: 1,
      configuration: { groupBy: "assignee" },
    });
    expect(updatedResponse.status).toBe(200);

    const persisted = await db.query.savedViewTable.findMany({
      where: eq(schema.savedViewTable.workspaceId, admin.workspace.id),
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      name: "Updated overview",
      position: 1,
      configuration: { groupBy: "assignee" },
    });
  });

  it("lets a disabled personal layer hide an inherited view and orders enabled views", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();
    const common = {
      workspaceId: admin.workspace.id,
      type: "list" as const,
      enabled: true,
      configuration: {},
    };

    for (const payload of [
      { ...common, key: "hidden", name: "Hidden", position: 0 },
      {
        ...common,
        projectId: project.id,
        userId: admin.user.id,
        key: "hidden",
        name: "Hidden personally",
        position: 0,
        enabled: false,
      },
      { ...common, key: "zeta", name: "Zeta", position: 2 },
      { ...common, key: "bravo", name: "Bravo", position: 1 },
      { ...common, key: "alpha", name: "Alpha", position: 1 },
    ]) {
      expect((await upsertSavedView(app, payload)).status).toBe(200);
    }

    const response = await app.request(
      `/api/saved-view/workspace/${admin.workspace.id}/project/${project.id}`,
    );
    expect(response.status).toBe(200);
    const views = (await response.json()) as Array<{ key: string }>;
    expect(views.map(({ key }) => key)).toEqual(["alpha", "bravo", "zeta"]);
  });

  it("validates saved view keys, names, types, positions, and configuration", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();
    const base = {
      workspaceId: admin.workspace.id,
      key: "valid-key",
      name: "Valid",
      type: "board" as const,
      position: 0,
      enabled: true,
      configuration: {},
    };

    for (const patch of [
      { key: "Invalid_Key" },
      { name: "   " },
      { name: "x".repeat(65) },
      { type: "calendar" },
      { position: 1.5 },
      { configuration: [] },
    ]) {
      const response = await upsertSavedView(app, {
        ...base,
        ...patch,
      } as SavedViewPayload);
      expect(response.status, JSON.stringify(patch)).toBe(400);
    }
  });
});
