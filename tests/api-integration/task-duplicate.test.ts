import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { copyTaskAssetObject, deleteS3Object, publishEvent } = vi.hoisted(
  () => ({
    deleteS3Object: vi.fn(async () => undefined),
    publishEvent: vi.fn(async () => undefined),
    copyTaskAssetObject: vi.fn(),
  }),
);

vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../apps/api/src/storage/s3")>();
  return { ...actual, copyTaskAssetObject, deleteS3Object };
});

vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent,
}));

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
    vi.clearAllMocks();
    copyTaskAssetObject.mockReset();
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

  async function fixture() {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const task = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
    });
    mockAuthenticatedSession(member.user);
    return { ...member, project, columns, task, app: createApp().app };
  }

  it("copies project custom fields and fills missing required defaults", async () => {
    const own = await fixture();
    const definitions = await db
      .insert(schema.customFieldDefinitionTable)
      .values([
        {
          projectId: own.project.id,
          name: "Estimate",
          type: "number",
          required: true,
        },
        { projectId: own.project.id, name: "Approved", type: "boolean" },
        { projectId: own.project.id, name: "Note", type: "text" },
        {
          projectId: own.project.id,
          name: "Category",
          type: "dropdown",
          required: true,
          defaultValue: "Work",
          options: ["Work", "Personal"],
        },
      ])
      .returning();
    await db.insert(schema.customFieldValueTable).values([
      { taskId: own.task.id, fieldId: definitions[0].id, value: "5" },
      { taskId: own.task.id, fieldId: definitions[1].id, value: "false" },
      { taskId: own.task.id, fieldId: definitions[2].id, value: null },
    ]);
    const { project: otherProject } = await createProjectFixture({
      workspaceId: own.workspace.id,
    });
    const [foreignField] = await db
      .insert(schema.customFieldDefinitionTable)
      .values({ projectId: otherProject.id, name: "Foreign", type: "text" })
      .returning();
    await db.insert(schema.customFieldValueTable).values({
      taskId: own.task.id,
      fieldId: foreignField.id,
      value: "do not copy",
    });
    const response = await requestDuplicate(own.app, own.task.id);
    expect(response.status).toBe(200);
    const copy = (await response.json()) as { id: string };
    const values = await db.query.customFieldValueTable.findMany({
      where: eq(schema.customFieldValueTable.taskId, copy.id),
    });
    expect(new Map(values.map((v) => [v.fieldId, v.value]))).toEqual(
      new Map([
        [definitions[0].id, "5"],
        [definitions[1].id, "false"],
        [definitions[2].id, ""],
        [definitions[3].id, "Work"],
      ]),
    );
    await db
      .delete(schema.taskTable)
      .where(eq(schema.taskTable.id, own.task.id));
    expect(
      await db.query.customFieldValueTable.findMany({
        where: eq(schema.customFieldValueTable.taskId, copy.id),
      }),
    ).toHaveLength(4);
  });

  it("rejects missing required fields before creating a task or copying storage", async () => {
    const own = await fixture();
    await db.insert(schema.customFieldDefinitionTable).values({
      projectId: own.project.id,
      name: "Required",
      type: "text",
      required: true,
    });
    const response = await requestDuplicate(own.app, own.task.id);
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("required");
    expect(await db.query.taskTable.findMany()).toHaveLength(1);
    expect(copyTaskAssetObject).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("rejects an obsolete custom-field dropdown value", async () => {
    const own = await fixture();
    const [field] = await db
      .insert(schema.customFieldDefinitionTable)
      .values({
        projectId: own.project.id,
        name: "Category",
        type: "dropdown",
        options: ["new"],
      })
      .returning();
    await db
      .insert(schema.customFieldValueTable)
      .values({ taskId: own.task.id, fieldId: field.id, value: "old" });
    expect((await requestDuplicate(own.app, own.task.id)).status).toBe(400);
    expect(await db.query.taskTable.findMany()).toHaveLength(1);
  });

  it("copies only same-workspace parents and labels from legacy mixed data", async () => {
    const own = await fixture();
    const other = await createWorkspaceMember();
    const { project: foreignProject, columns: foreignColumns } =
      await createProjectFixture({ workspaceId: other.workspace.id });
    const foreignParent = await seedTask({
      projectId: foreignProject.id,
      columnId: foreignColumns.todo.id,
    });
    const { project: siblingProject, columns: siblingColumns } =
      await createProjectFixture({ workspaceId: own.workspace.id });
    const parent = await seedTask({
      projectId: siblingProject.id,
      columnId: siblingColumns.todo.id,
    });
    await db.insert(schema.taskRelationTable).values(
      [parent, foreignParent].map((p) => ({
        sourceTaskId: p.id,
        targetTaskId: own.task.id,
        relationType: "subtask",
      })),
    );
    await db.insert(schema.labelTable).values([
      {
        taskId: own.task.id,
        workspaceId: own.workspace.id,
        name: "Local",
        color: "blue",
      },
      {
        taskId: own.task.id,
        workspaceId: other.workspace.id,
        name: "Foreign",
        color: "red",
      },
    ]);
    const response = await requestDuplicate(own.app, own.task.id);
    expect(response.status).toBe(200);
    const copy = (await response.json()) as { id: string };
    expect(
      await db.query.taskRelationTable.findMany({
        where: eq(schema.taskRelationTable.targetTaskId, copy.id),
      }),
    ).toMatchObject([{ sourceTaskId: parent.id }]);
    const labels = await db.query.labelTable.findMany({
      where: eq(schema.labelTable.taskId, copy.id),
    });
    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe("Local");
    const relationEvents = publishEvent.mock.calls.filter(
      ([name]) => name === "task-relation.created",
    );
    expect(relationEvents).toHaveLength(1);
    expect(relationEvents[0][1]).toMatchObject({
      sourceTaskId: parent.id,
      projectId: siblingProject.id,
    });
  });

  it("allocates distinct task numbers and positions for simultaneous copies", async () => {
    const own = await fixture();
    const responses = await Promise.all([
      requestDuplicate(own.app, own.task.id),
      requestDuplicate(own.app, own.task.id),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const copies = (await Promise.all(responses.map((r) => r.json()))) as {
      number: number;
      position: number;
    }[];
    expect(copies.map((c) => c.number).sort()).toEqual([2, 3]);
    expect(copies.map((c) => c.position).sort()).toEqual([2, 3]);
  });

  it("repairs a full position range before appending the copy", async () => {
    const own = await fixture();
    await db
      .update(schema.taskTable)
      .set({ position: 2147483647 })
      .where(eq(schema.taskTable.id, own.task.id));
    const response = await requestDuplicate(own.app, own.task.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ position: 2 });
  });

  it("does not carry a foreign assignee into a new task", async () => {
    const own = await fixture();
    const other = await createWorkspaceMember();
    await db
      .update(schema.taskTable)
      .set({ userId: other.user.id })
      .where(eq(schema.taskTable.id, own.task.id));
    expect((await requestDuplicate(own.app, own.task.id)).status).toBe(403);
    expect(await db.query.taskTable.findMany()).toHaveLength(1);
  });

  it("cleans up partial asset copies and returns a safe error", async () => {
    const own = await fixture();
    const ids = ["firstasset", "secondasset"];
    await db
      .update(schema.taskTable)
      .set({
        description: ids.map((id) => `![Image](/api/asset/${id})`).join("\n"),
      })
      .where(eq(schema.taskTable.id, own.task.id));
    await db.insert(schema.assetTable).values(
      ids.map((id) => ({
        id,
        taskId: own.task.id,
        projectId: own.project.id,
        workspaceId: own.workspace.id,
        objectKey: id,
        filename: "image.png",
        mimeType: "image/png",
        size: 10,
        kind: "image",
        surface: "description",
        createdBy: own.user.id,
      })),
    );
    copyTaskAssetObject
      .mockResolvedValueOnce("copied-first")
      .mockRejectedValueOnce(new Error("private bucket details"));
    const response = await requestDuplicate(own.app, own.task.id);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Failed to copy the task attachments");
    expect(deleteS3Object).toHaveBeenCalledWith("copied-first");
    expect(await db.query.taskTable.findMany()).toHaveLength(1);
    expect(publishEvent).not.toHaveBeenCalled();
  });
});
