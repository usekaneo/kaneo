import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import updateTaskTitle from "../../apps/api/src/task/controllers/update-task-title";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function createTaskFixture() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Original title",
      description: "Activity test task",
      status: "to-do",
      columnId: columns.todo.id,
      priority: "medium",
      number: 1,
      position: 1,
    })
    .returning();

  return { member, task };
}

describe("API integration: task title activity", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("persists the title and its activity before returning", async () => {
    const { member, task } = await createTaskFixture();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/title/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated title" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: task.id,
      title: "Updated title",
    });

    const [persistedTask, activities] = await Promise.all([
      db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
      db
        .select()
        .from(schema.activityTable)
        .where(
          and(
            eq(schema.activityTable.taskId, task.id),
            eq(schema.activityTable.type, "title_changed"),
          ),
        ),
    ]);

    expect(persistedTask?.title).toBe("Updated title");
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      taskId: task.id,
      userId: member.user.id,
      type: "title_changed",
      eventData: {
        oldTitle: "Original title",
        newTitle: "Updated title",
      },
    });
  });

  it("does not create activity for an unchanged title", async () => {
    const { member, task } = await createTaskFixture();

    const result = await updateTaskTitle({
      id: task.id,
      title: task.title,
      currentUserId: member.user.id,
    });

    expect(result.title).toBe(task.title);
    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, task.id));
    expect(activities).toHaveLength(0);
  });

  it("rolls back the title when the activity insert fails", async () => {
    const { task } = await createTaskFixture();

    await expect(
      updateTaskTitle({
        id: task.id,
        title: "Must not persist",
        currentUserId: "missing-user",
      }),
    ).rejects.toThrow();

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, task.id));

    expect(persistedTask?.title).toBe("Original title");
    expect(activities).toHaveLength(0);
  });
});
