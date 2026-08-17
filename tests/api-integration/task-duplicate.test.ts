import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { copyTaskAssetObject } = vi.hoisted(() => ({
  copyTaskAssetObject: vi.fn(),
}));

vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../apps/api/src/storage/s3")>();
  return { ...actual, copyTaskAssetObject };
});

import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const DUPLICATED_OBJECT_KEY =
  "workspace/ws/project/pj/task/copy/descriptions/diagram-1-copy.png";

async function seedTask({
  projectId,
  columnId,
  userId,
  overrides,
}: {
  projectId: string;
  columnId: string | null;
  userId?: string;
  overrides?: Partial<typeof schema.taskTable.$inferInsert>;
}) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      columnId,
      title: "Release checklist",
      description: "Steps to cut a release",
      status: "to-do",
      priority: "high",
      number: 1,
      position: 1,
      ...(userId ? { userId } : {}),
      ...overrides,
    })
    .returning();

  if (!task) {
    throw new Error("Failed to seed task");
  }

  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: task.number ?? 1 })
    .where(eq(schema.projectTable.id, projectId));

  return task;
}

function requestDuplicate(
  app: ReturnType<typeof createApp>["app"],
  taskId: string,
  body: { title?: string } = {},
) {
  return app.request(`/api/task/duplicate/${taskId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("API integration: task duplication", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    copyTaskAssetObject.mockImplementation(async () => DUPLICATED_OBJECT_KEY);
  });

  it("rejects unauthenticated task duplication requests", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const task = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
    });

    mockAnonymousSession();
    const { app } = createApp();

    const response = await requestDuplicate(app, task.id);

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Unauthorized");
  });

  it("blocks a viewer from duplicating a task (viewer role lacks task:create)", async () => {
    const viewer = await createWorkspaceMember({ role: "viewer" });
    const { project, columns } = await createProjectFixture({
      workspaceId: viewer.workspace.id,
    });
    const task = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
    });

    mockAuthenticatedSession(viewer.user);
    const { app } = createApp();

    const response = await requestDuplicate(app, task.id);

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe("Insufficient permissions");

    const tasks = await db.query.taskTable.findMany({
      where: eq(schema.taskTable.projectId, project.id),
    });

    expect(tasks).toHaveLength(1);
  });

  it("rejects duplication for users outside the project workspace", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const task = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
    });

    const outsiderId = `user-${randomUUID()}`;
    const [outsider] = await db
      .insert(schema.userTable)
      .values({
        id: outsiderId,
        email: `${outsiderId}@example.com`,
        emailVerified: true,
        name: "Duplicate Outsider",
      })
      .returning();

    mockAuthenticatedSession(outsider);
    const { app } = createApp();

    const response = await requestDuplicate(app, task.id);

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe(
      "You don't have access to this workspace",
    );

    const tasks = await db.query.taskTable.findMany({
      where: eq(schema.taskTable.projectId, project.id),
    });

    expect(tasks).toHaveLength(1);
  });

  it("copies the task fields and labels into a new task at the end of the column", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const task = await seedTask({
      projectId: project.id,
      columnId: columns.inProgress.id,
      userId: member.user.id,
      overrides: {
        status: "in-progress",
        startDate: new Date("2026-04-01T09:00:00.000Z"),
        dueDate: new Date("2026-04-05T17:00:00.000Z"),
      },
    });

    await db.insert(schema.labelTable).values([
      {
        name: "backend",
        color: "#FF6600",
        taskId: task.id,
        workspaceId: member.workspace.id,
      },
      {
        name: "release",
        color: "#00AAFF",
        taskId: task.id,
        workspaceId: member.workspace.id,
      },
    ]);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await requestDuplicate(app, task.id, {
      title: "Release checklist (copy)",
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      title: string;
      number: number | null;
      position: number | null;
      assigneeName?: string;
    };

    expect(payload.id).not.toBe(task.id);
    expect(payload).toMatchObject({
      title: "Release checklist (copy)",
      number: 2,
      position: 2,
      assigneeName: member.user.name,
    });

    const duplicatedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, payload.id),
    });

    expect(duplicatedTask).toMatchObject({
      projectId: project.id,
      columnId: columns.inProgress.id,
      userId: member.user.id,
      title: "Release checklist (copy)",
      description: task.description,
      status: "in-progress",
      priority: "high",
      number: 2,
      position: 2,
    });
    expect(duplicatedTask?.startDate?.toISOString()).toBe(
      "2026-04-01T09:00:00.000Z",
    );
    expect(duplicatedTask?.dueDate?.toISOString()).toBe(
      "2026-04-05T17:00:00.000Z",
    );

    const duplicatedLabels = await db
      .select({
        name: schema.labelTable.name,
        color: schema.labelTable.color,
        workspaceId: schema.labelTable.workspaceId,
      })
      .from(schema.labelTable)
      .where(eq(schema.labelTable.taskId, payload.id));

    expect(duplicatedLabels).toEqual(
      expect.arrayContaining([
        {
          name: "backend",
          color: "#FF6600",
          workspaceId: member.workspace.id,
        },
        {
          name: "release",
          color: "#00AAFF",
          workspaceId: member.workspace.id,
        },
      ]),
    );
    expect(duplicatedLabels).toHaveLength(2);

    const sourceTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });

    expect(sourceTask).toMatchObject({
      title: "Release checklist",
      number: 1,
      position: 1,
    });
  });

  it("keeps a duplicated subtask under the same parent without copying its own subtasks", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const parent = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
      overrides: { title: "Release epic", number: 1, position: 1 },
    });
    const subtask = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
      overrides: { title: "Bump version", number: 2, position: 2 },
    });
    const grandchild = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
      overrides: { title: "Update changelog", number: 3, position: 3 },
    });

    await db.insert(schema.taskRelationTable).values([
      {
        sourceTaskId: parent.id,
        targetTaskId: subtask.id,
        relationType: "subtask",
      },
      {
        sourceTaskId: subtask.id,
        targetTaskId: grandchild.id,
        relationType: "subtask",
      },
    ]);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await requestDuplicate(app, subtask.id);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { id: string };

    const parentsOfCopy = await db
      .select({
        sourceTaskId: schema.taskRelationTable.sourceTaskId,
        relationType: schema.taskRelationTable.relationType,
      })
      .from(schema.taskRelationTable)
      .where(eq(schema.taskRelationTable.targetTaskId, payload.id));

    expect(parentsOfCopy).toEqual([
      { sourceTaskId: parent.id, relationType: "subtask" },
    ]);

    const childrenOfCopy = await db
      .select({ id: schema.taskRelationTable.id })
      .from(schema.taskRelationTable)
      .where(eq(schema.taskRelationTable.sourceTaskId, payload.id));

    expect(childrenOfCopy).toEqual([]);
  });

  it("copies the description assets and repoints the copy at them", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const sourceAssetId = "asset1sourcekey000000001";
    const task = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
      overrides: {
        description: `<p>Before</p><img src="http://localhost:1337/api/asset/${sourceAssetId}" alt="Diagram" /><p>After</p>`,
      },
    });

    await db.insert(schema.assetTable).values({
      id: sourceAssetId,
      workspaceId: member.workspace.id,
      projectId: project.id,
      taskId: task.id,
      objectKey:
        "workspace/ws/project/pj/task/source/descriptions/diagram-1.png",
      filename: "diagram-1.png",
      mimeType: "image/png",
      size: 2048,
      kind: "image",
      surface: "description",
      createdBy: member.user.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await requestDuplicate(app, task.id);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      description: string;
    };

    expect(copyTaskAssetObject).toHaveBeenCalledTimes(1);
    expect(copyTaskAssetObject).toHaveBeenCalledWith({
      sourceKey:
        "workspace/ws/project/pj/task/source/descriptions/diagram-1.png",
      destination: {
        workspaceId: member.workspace.id,
        projectId: project.id,
        taskId: payload.id,
        surface: "description",
        filename: "diagram-1.png",
        contentType: "image/png",
      },
    });

    const [duplicatedAsset] = await db
      .select()
      .from(schema.assetTable)
      .where(eq(schema.assetTable.taskId, payload.id));

    expect(duplicatedAsset).toMatchObject({
      workspaceId: member.workspace.id,
      projectId: project.id,
      objectKey: DUPLICATED_OBJECT_KEY,
      filename: "diagram-1.png",
      mimeType: "image/png",
      size: 2048,
      kind: "image",
      surface: "description",
      createdBy: member.user.id,
    });
    expect(duplicatedAsset?.id).not.toBe(sourceAssetId);

    expect(payload.description).toContain(`/api/asset/${duplicatedAsset?.id}`);
    expect(payload.description).not.toContain(sourceAssetId);

    const sourceTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });

    expect(sourceTask?.description).toContain(`/api/asset/${sourceAssetId}`);
  });

  it("keeps the source title when no title override is provided", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const task = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await requestDuplicate(app, task.id);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { id: string; title: string };

    expect(payload.title).toBe("Release checklist");

    const duplicatedTask = await db.query.taskTable.findFirst({
      where: and(
        eq(schema.taskTable.id, payload.id),
        eq(schema.taskTable.projectId, project.id),
      ),
    });

    expect(duplicatedTask?.title).toBe("Release checklist");
  });
});
