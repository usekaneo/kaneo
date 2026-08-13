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

async function addWorkspaceMember(workspaceId: string) {
  const userId = `user-${randomUUID()}`;

  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: "Other Member",
    })
    .returning();

  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role: "member",
    joinedAt: new Date(),
  });

  return user;
}

async function createTaskFixture() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Activity attribution",
      status: "to-do",
      columnId: columns.todo.id,
      priority: "medium",
      number: 1,
      position: 1,
    })
    .returning();

  return { member, task };
}

describe("API integration: activity authorship", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("attributes a created activity to the caller, not to a userId in the body", async () => {
    const { member, task } = await createTaskFixture();
    const colleague = await addWorkspaceMember(member.workspace.id);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/activity/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        userId: colleague.id,
        message: "Attributed to a colleague",
        type: "status_changed",
      }),
    });

    expect(response.status).toBe(200);

    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, task.id));

    expect(activities).toHaveLength(1);
    expect(activities[0]?.userId).toBe(member.user.id);
  });

  it("attributes a created activity to the caller", async () => {
    const { member, task } = await createTaskFixture();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/activity/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        message: "Attributed to the caller",
        type: "status_changed",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      taskId: task.id,
      userId: member.user.id,
      content: "Attributed to the caller",
      type: "status_changed",
    });
  });
});
