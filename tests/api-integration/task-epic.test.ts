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

describe("API integration: epics", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("defaults a newly created task's type to task", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Regular task",
        description: "",
        priority: "low",
        status: "to-do",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { id: string; type: string };
    expect(payload.type).toBe("task");

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, payload.id),
    });
    expect(persistedTask?.type).toBe("task");
  });

  it("creates a task with type epic", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Website redesign",
        description: "Everything the redesign touches",
        priority: "medium",
        status: "to-do",
        type: "epic",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { id: string; type: string };
    expect(payload).toMatchObject({
      title: "Website redesign",
      type: "epic",
    });

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, payload.id),
    });
    expect(persistedTask?.type).toBe("epic");
  });

  it("rejects an unknown task type", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Not a real type",
        description: "",
        priority: "low",
        status: "to-do",
        type: "story",
      }),
    });

    expect(response.status).toBe(400);
  });

  it("creates an epic-type task relation linking an epic to a child task", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const [epic] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Epic",
        type: "epic",
        status: "to-do",
        columnId: columns.todo.id,
        number: 1,
        position: 1,
      })
      .returning();
    const [child] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Child task",
        type: "task",
        status: "to-do",
        columnId: columns.todo.id,
        number: 2,
        position: 2,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/task-relation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceTaskId: epic.id,
        targetTaskId: child.id,
        relationType: "epic",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      sourceTaskId: string;
      targetTaskId: string;
      relationType: string;
    };
    expect(payload).toMatchObject({
      sourceTaskId: epic.id,
      targetTaskId: child.id,
      relationType: "epic",
    });

    const persistedRelation = await db.query.taskRelationTable.findFirst({
      where: eq(schema.taskRelationTable.id, payload.id),
    });
    expect(persistedRelation).toMatchObject({
      sourceTaskId: epic.id,
      targetTaskId: child.id,
      relationType: "epic",
    });
  });

  it("lists only epic-type tasks when filtering the project's tasks by type", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    await db.insert(schema.taskTable).values([
      {
        projectId: project.id,
        title: "Epic A",
        type: "epic",
        status: "to-do",
        columnId: columns.todo.id,
        number: 1,
        position: 1,
      },
      {
        projectId: project.id,
        title: "Regular task",
        type: "task",
        status: "to-do",
        columnId: columns.todo.id,
        number: 2,
        position: 2,
      },
      {
        projectId: project.id,
        title: "Planned epic",
        type: "epic",
        status: "planned",
        number: 3,
        position: 1,
      },
    ]);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/task/tasks/${project.id}?type=epic`,
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: {
        columns: { tasks: { title: string; type: string }[] }[];
        plannedTasks: { title: string; type: string }[];
        archivedTasks: { title: string; type: string }[];
      };
    };

    const allReturnedTasks = [
      ...payload.data.columns.flatMap((column) => column.tasks),
      ...payload.data.plannedTasks,
      ...payload.data.archivedTasks,
    ];

    expect(allReturnedTasks).toHaveLength(2);
    expect(allReturnedTasks.map((task) => task.title).sort()).toEqual([
      "Epic A",
      "Planned epic",
    ]);
    expect(allReturnedTasks.every((task) => task.type === "epic")).toBe(true);
  });
});
