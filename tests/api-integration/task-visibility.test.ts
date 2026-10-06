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

async function addMember(workspaceId: string, role: string) {
  const userId = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: `${role} user`,
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

let taskCounter = 0;

async function seedTask(
  projectId: string,
  columnId: string | null,
  assigneeId: string | null,
  title: string,
) {
  taskCounter += 1;
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title,
      description: "",
      priority: "medium",
      status: "to-do",
      columnId,
      number: taskCounter,
      position: taskCounter,
      userId: assigneeId,
    })
    .returning();

  // Keep the project's counter ahead of the seeded rows so a task created
  // through the API does not collide on (projectId, number).
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: taskCounter })
    .where(eq(schema.projectTable.id, projectId));

  return task;
}

type Board = {
  data: { columns: { tasks: { id: string; title: string }[] }[] };
};

async function boardTitles(
  app: ReturnType<typeof createApp>["app"],
  projectId: string,
) {
  const response = await app.request(`/api/task/tasks/${projectId}`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as Board;
  return body.data.columns
    .flatMap((column) => column.tasks)
    .map((task) => task.title)
    .sort();
}

describe("API integration: assignee-scoped task visibility", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    taskCounter = 0;
  });

  async function seedWorkspace() {
    const admin = await createWorkspaceMember({ role: "admin" });
    const member = await addMember(admin.workspace.id, "member");
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });

    const ownTask = await seedTask(
      project.id,
      columns.todo.id,
      member.id,
      "Member task",
    );
    const otherTask = await seedTask(
      project.id,
      columns.todo.id,
      admin.user.id,
      "Admin task",
    );
    const unassignedTask = await seedTask(
      project.id,
      columns.todo.id,
      null,
      "Unassigned task",
    );

    return {
      admin,
      member,
      project,
      columns,
      ownTask,
      otherTask,
      unassignedTask,
    };
  }

  it("shows a member their own tasks and the unclaimed backlog", async () => {
    const { member, project } = await seedWorkspace();

    mockAuthenticatedSession(member);
    const { app } = createApp();

    await expect(boardTitles(app, project.id)).resolves.toEqual([
      "Member task",
      "Unassigned task",
    ]);
  });

  it("still shows every task to a user who can assign tasks", async () => {
    const { admin, project } = await seedWorkspace();

    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    await expect(boardTitles(app, project.id)).resolves.toEqual([
      "Admin task",
      "Member task",
      "Unassigned task",
    ]);
  });

  it("answers 404 when a member reads a task assigned to someone else", async () => {
    const { member, ownTask, otherTask } = await seedWorkspace();

    mockAuthenticatedSession(member);
    const { app } = createApp();

    await expect(
      app.request(`/api/task/${ownTask.id}`).then((res) => res.status),
    ).resolves.toBe(200);
    await expect(
      app.request(`/api/task/${otherTask.id}`).then((res) => res.status),
    ).resolves.toBe(404);
  });

  it("answers 404 when a member bulk-updates a hidden task", async () => {
    const { member, otherTask } = await seedWorkspace();

    mockAuthenticatedSession(member);
    const { app } = createApp();

    const response = await app.request("/api/task/bulk", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskIds: [otherTask.id],
        operation: "updatePriority",
        value: "low",
      }),
    });

    expect(response.status).toBe(404);

    const unchanged = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, otherTask.id),
    });
    expect(unchanged?.priority).toBe("medium");
  });

  it("keeps a hidden task out of a member's search results", async () => {
    const { admin, member } = await seedWorkspace();

    mockAuthenticatedSession(member);
    const { app } = createApp();

    const response = await app.request(
      `/api/search?q=task&workspaceId=${admin.workspace.id}`,
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      results: { title: string }[];
    };
    expect(body.results.map((result) => result.title).sort()).toEqual([
      "Member task",
      "Unassigned task",
    ]);
  });

  it("refuses to let a member hand a new task to someone else", async () => {
    const { admin, member, project } = await seedWorkspace();

    mockAuthenticatedSession(member);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Created by member",
        description: "",
        priority: "low",
        status: "to-do",
        userId: admin.user.id,
      }),
    });

    expect(response.status).toBe(403);

    const created = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.title, "Created by member"),
    });
    expect(created).toBeUndefined();
  });

  it("lets a member create a task for themselves or for nobody", async () => {
    const { member, project } = await seedWorkspace();

    mockAuthenticatedSession(member);
    const { app } = createApp();

    async function create(title: string, userId: string) {
      const response = await app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description: "",
          priority: "low",
          status: "to-do",
          userId,
        }),
      });
      expect(response.status).toBe(200);
      return (await response.json()) as { userId: string | null };
    }

    await expect(create("For me", member.id)).resolves.toMatchObject({
      userId: member.id,
    });
    await expect(create("For nobody", "")).resolves.toMatchObject({
      userId: null,
    });
  });

  it("rejects only the imported rows aimed at another member", async () => {
    const { admin, member, project } = await seedWorkspace();

    mockAuthenticatedSession(member);
    const { app } = createApp();

    const response = await app.request(`/api/task/import/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tasks: [
          {
            title: "Imported for admin",
            status: "to-do",
            userId: admin.user.id,
          },
          { title: "Imported for me", status: "to-do", userId: member.id },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results: { successful: number; failed: number };
    };
    expect(body.results).toMatchObject({ successful: 1, failed: 1 });

    await expect(
      db.query.taskTable.findFirst({
        where: eq(schema.taskTable.title, "Imported for admin"),
      }),
    ).resolves.toBeUndefined();
    await expect(
      db.query.taskTable.findFirst({
        where: eq(schema.taskTable.title, "Imported for me"),
      }),
    ).resolves.toMatchObject({ userId: member.id });
  });

  it("hides a label attached to a task the member cannot see", async () => {
    const { admin, member, otherTask } = await seedWorkspace();

    const [hiddenLabel] = await db
      .insert(schema.labelTable)
      .values({
        name: "hidden-label",
        color: "gray",
        taskId: otherTask.id,
        workspaceId: admin.workspace.id,
      })
      .returning();

    await db.insert(schema.labelTable).values({
      name: "shared-label",
      color: "blue",
      taskId: null,
      workspaceId: admin.workspace.id,
    });

    mockAuthenticatedSession(member);
    const { app } = createApp();

    await expect(
      app.request(`/api/label/${hiddenLabel.id}`).then((res) => res.status),
    ).resolves.toBe(404);

    const listResponse = await app.request(
      `/api/label/workspace/${admin.workspace.id}`,
    );
    expect(listResponse.status).toBe(200);
    const labels = (await listResponse.json()) as { name: string }[];
    expect(labels.map((label) => label.name)).toEqual(["shared-label"]);
  });
});
