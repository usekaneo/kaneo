import { randomUUID } from "node:crypto";
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

async function addMember(workspaceId: string, userId: string, role = "member") {
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId,
    role,
    joinedAt: new Date(),
  });
}

async function createTargetWorkspace() {
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: `workspace-${randomUUID()}`,
      createdAt: new Date(),
      name: "Target Workspace",
      slug: `workspace-${randomUUID()}`,
    })
    .returning();

  return workspace;
}

// Activity rows are written by an event subscriber that the request doesn't
// await, so give the emitter a moment to drain before asserting.
async function waitForActivities(taskId: string, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const rows = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, taskId));

    if (rows.length > 0) return rows;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return [];
}

function moveRequest(workspaceId: string) {
  return {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId }),
  };
}

describe("API integration: moving a project between workspaces", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects a move into a workspace the caller doesn't belong to", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createTargetWorkspace();
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project/${project.id}/move`,
      moveRequest(target.id),
    );

    expect(response.status).toBe(403);

    const [unchanged] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(unchanged.workspaceId).toBe(owner.workspace.id);
  });

  it("rejects a move when the caller can't create projects in the target", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createTargetWorkspace();
    // `viewer` grants only project:read in the target workspace.
    await addMember(target.id, owner.user.id, "viewer");
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project/${project.id}/move`,
      moveRequest(target.id),
    );

    expect(response.status).toBe(403);
  });

  it("rejects a move when the target workspace already uses the project's key", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createTargetWorkspace();
    await addMember(target.id, owner.user.id, "owner");

    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      slug: "kan",
    });
    // Different case on purpose: short-id lookup matches keys
    // case-insensitively, so "KAN" and "kan" collide just the same.
    await createProjectFixture({
      workspaceId: target.id,
      name: "Incumbent",
      slug: "KAN",
    });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project/${project.id}/move`,
      moveRequest(target.id),
    );

    expect(response.status).toBe(409);
    expect(await response.text()).toContain("Incumbent");

    const [unchanged] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(unchanged.workspaceId).toBe(owner.workspace.id);
  });

  it("allows a move when only the source workspace uses that key", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createTargetWorkspace();
    await addMember(target.id, owner.user.id, "owner");

    // A same-key project left behind in the source must not block the move —
    // only the target workspace's keys matter.
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      slug: "kan",
    });
    await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Sibling",
      slug: "kan",
    });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project/${project.id}/move`,
      moveRequest(target.id),
    );

    expect(response.status).toBe(200);

    const [moved] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(moved.workspaceId).toBe(target.id);
  });

  it("rejects a move out of a workspace where the caller can't delete projects", async () => {
    const mover = await createWorkspaceMember({ role: "project-editor" });
    const target = await createTargetWorkspace();
    // Full rights in the target, so a 403 here can only come from the source.
    await addMember(target.id, mover.user.id, "owner");
    // A custom role is the only way to hold `update` without `delete`: every
    // built-in role that grants one grants the other.
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: mover.workspace.id,
      role: "project-editor",
      permission: JSON.stringify({
        project: ["create", "read", "update"],
      }),
    });

    const { project } = await createProjectFixture({
      workspaceId: mover.workspace.id,
    });

    mockAuthenticatedSession(mover.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project/${project.id}/move`,
      moveRequest(target.id),
    );

    expect(response.status).toBe(403);

    const [unchanged] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(unchanged.workspaceId).toBe(mover.workspace.id);
  });

  it("rejects a move into the workspace the project is already in", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project/${project.id}/move`,
      moveRequest(owner.workspace.id),
    );

    expect(response.status).toBe(400);
  });

  it("moves the project and rewrites workspace-scoped side data", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createTargetWorkspace();
    await addMember(target.id, owner.user.id, "owner");

    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Ship it",
        columnId: columns.todo.id,
        number: 1,
        userId: owner.user.id,
      })
      .returning();

    const [label] = await db
      .insert(schema.labelTable)
      .values({
        name: "bug",
        color: "#ff0000",
        taskId: task.id,
        workspaceId: owner.workspace.id,
      })
      .returning();

    const [asset] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: owner.workspace.id,
        projectId: project.id,
        taskId: task.id,
        objectKey: `object-${randomUUID()}`,
        filename: "screenshot.png",
        mimeType: "image/png",
        size: 1234,
      })
      .returning();

    // A notification rule referencing the project through the composite
    // (workspaceId, projectId) foreign key. Left in place, the workspace
    // update would cascade into it and break the rule-side key.
    const [rule] = await db
      .insert(schema.userNotificationWorkspaceRuleTable)
      .values({
        userId: owner.user.id,
        workspaceId: owner.workspace.id,
        projectMode: "selected",
      })
      .returning();

    await db.insert(schema.userNotificationWorkspaceProjectTable).values({
      workspaceId: owner.workspace.id,
      workspaceRuleId: rule.id,
      projectId: project.id,
    });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project/${project.id}/move`,
      moveRequest(target.id),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      workspaceId: string;
      unassignedTaskCount: number;
    };
    expect(payload.workspaceId).toBe(target.id);
    expect(payload.unassignedTaskCount).toBe(0);

    const [movedProject] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(movedProject.workspaceId).toBe(target.id);

    const [movedLabel] = await db
      .select()
      .from(schema.labelTable)
      .where(eq(schema.labelTable.id, label.id));
    expect(movedLabel.workspaceId).toBe(target.id);

    const [movedAsset] = await db
      .select()
      .from(schema.assetTable)
      .where(eq(schema.assetTable.id, asset.id));
    expect(movedAsset.workspaceId).toBe(target.id);

    const notificationProjects = await db
      .select()
      .from(schema.userNotificationWorkspaceProjectTable)
      .where(
        eq(schema.userNotificationWorkspaceProjectTable.projectId, project.id),
      );
    expect(notificationProjects).toHaveLength(0);

    // The task and its column survive the move.
    const [movedTask] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(movedTask.columnId).toBe(columns.todo.id);

    const sourceListing = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(sourceListing.status).toBe(200);
    const sourceProjects = (await sourceListing.json()) as { id: string }[];
    expect(sourceProjects.map((item) => item.id)).not.toContain(project.id);
  });

  it("unassigns tasks whose assignee isn't a member of the target workspace", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const outsider = await createWorkspaceMember({ role: "member" });
    const target = await createTargetWorkspace();
    await addMember(target.id, owner.user.id, "owner");
    // `outsider.user` is deliberately never added to the target workspace.
    await addMember(owner.workspace.id, outsider.user.id, "member");

    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });

    const [keptTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Stays assigned",
        columnId: columns.todo.id,
        number: 1,
        userId: owner.user.id,
      })
      .returning();

    const [droppedTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Loses its assignee",
        columnId: columns.todo.id,
        number: 2,
        userId: outsider.user.id,
      })
      .returning();

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project/${project.id}/move`,
      moveRequest(target.id),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { unassignedTaskCount: number };
    expect(payload.unassignedTaskCount).toBe(1);

    const [kept] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, keptTask.id));
    expect(kept.userId).toBe(owner.user.id);

    const [dropped] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, droppedTask.id));
    expect(dropped.userId).toBeNull();

    // Losing an assignee has to land on the task's timeline, the same way a
    // manual or bulk unassignment does — otherwise there's no record of which
    // tasks a move touched.
    const activities = await waitForActivities(droppedTask.id);
    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe("unassigned");
    expect(activities[0].userId).toBe(owner.user.id);

    const keptActivities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, keptTask.id));
    expect(keptActivities).toHaveLength(0);
  });
});
