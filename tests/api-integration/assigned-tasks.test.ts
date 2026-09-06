import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { MAX_ASSIGNED_TASKS } from "../../apps/api/src/task/controllers/get-assigned-tasks";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type AssignedTasksResponse = {
  data: {
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      projectId: string;
      dueDate: string | null;
      labels: Array<{ name: string }>;
    }>;
    projects: Array<{
      id: string;
      slug: string;
      workspaceId: string;
      workspaceName: string;
      columns: Array<{ slug: string; isFinal: boolean }>;
    }>;
  };
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

async function insertTask({
  projectId,
  columnId,
  userId,
  title,
  status = "to-do",
  dueDate = null,
}: {
  projectId: string;
  columnId: string | null;
  userId: string | null;
  title: string;
  status?: string;
  dueDate?: Date | null;
}) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      columnId,
      userId,
      title,
      status,
      dueDate,
      priority: "medium",
      number: Math.floor(Math.random() * 100000),
    })
    .returning();
  return task;
}

async function addMember(workspaceId: string, userId: string) {
  await db.insert(schema.workspaceUserTable).values({
    id: randomUUID(),
    workspaceId,
    userId,
    role: "member",
    joinedAt: new Date(),
  });
}

describe("API integration: tasks assigned to me", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects anonymous requests", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/user/tasks");

    expect(response.status).toBe(401);
  });

  it("returns my open tasks from every workspace I belong to, with their projects", async () => {
    const me = await createWorkspaceMember({ userName: "Me" });
    const other = await createWorkspaceMember({
      userName: "Other",
      workspaceName: "Second workspace",
    });
    await addMember(other.workspace.id, me.user.id);

    const first = await createProjectFixture({
      workspaceId: me.workspace.id,
      slug: "first",
    });
    const second = await createProjectFixture({
      workspaceId: other.workspace.id,
      slug: "second",
    });

    const soon = await insertTask({
      projectId: second.project.id,
      columnId: second.columns.inProgress.id,
      userId: me.user.id,
      title: "Due soon",
      status: "in-progress",
      dueDate: new Date("2026-09-10T00:00:00.000Z"),
    });
    const later = await insertTask({
      projectId: first.project.id,
      columnId: first.columns.todo.id,
      userId: me.user.id,
      title: "Due later",
      dueDate: new Date("2026-09-20T00:00:00.000Z"),
    });
    const undated = await insertTask({
      projectId: first.project.id,
      columnId: first.columns.todo.id,
      userId: me.user.id,
      title: "No due date",
    });
    await insertTask({
      projectId: first.project.id,
      columnId: first.columns.todo.id,
      userId: other.user.id,
      title: "Someone else's",
    });
    await insertTask({
      projectId: first.project.id,
      columnId: null,
      userId: me.user.id,
      title: "Planned",
      status: "planned",
    });
    await insertTask({
      projectId: first.project.id,
      columnId: null,
      userId: me.user.id,
      title: "Archived",
      status: "archived",
    });
    await db.insert(schema.labelTable).values({
      name: "urgent-ish",
      color: "red",
      taskId: soon.id,
      workspaceId: other.workspace.id,
    });

    mockAuthenticatedSession(me.user);
    const { app } = createApp();

    const response = await app.request("/api/user/tasks");
    expect(response.status).toBe(200);
    const body = (await response.json()) as AssignedTasksResponse;

    expect(body.data.tasks.map((task) => task.id)).toEqual([
      soon.id,
      later.id,
      undated.id,
    ]);
    expect(body.data.tasks[0]?.labels.map((label) => label.name)).toEqual([
      "urgent-ish",
    ]);
    expect(body.pagination).toEqual({
      total: 3,
      page: 1,
      pageSize: MAX_ASSIGNED_TASKS,
      totalPages: 1,
    });

    expect(body.data.projects.map((project) => project.slug).sort()).toEqual([
      "first",
      "second",
    ]);
    const secondProject = body.data.projects.find((p) => p.slug === "second");
    expect(secondProject?.workspaceId).toBe(other.workspace.id);
    expect(secondProject?.workspaceName).toBe("Second workspace");
    expect(secondProject?.columns.map((column) => column.slug)).toEqual([
      "to-do",
      "in-progress",
      "in-review",
      "done",
    ]);
  });

  it("leaves out tasks from workspaces I no longer belong to and archived projects", async () => {
    const me = await createWorkspaceMember({ userName: "Me" });
    const former = await createWorkspaceMember({
      userName: "Former colleague",
      workspaceName: "Former workspace",
    });

    // Assigned while I was a member, membership removed afterwards.
    await addMember(former.workspace.id, me.user.id);
    const formerProject = await createProjectFixture({
      workspaceId: former.workspace.id,
      slug: "former",
    });
    const stale = await insertTask({
      projectId: formerProject.project.id,
      columnId: formerProject.columns.todo.id,
      userId: me.user.id,
      title: "Stale assignment",
    });
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, me.user.id));
    await addMember(me.workspace.id, me.user.id);

    const archivedProject = await createProjectFixture({
      workspaceId: me.workspace.id,
      slug: "archived",
    });
    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.projectTable.id, archivedProject.project.id));
    const inArchived = await insertTask({
      projectId: archivedProject.project.id,
      columnId: archivedProject.columns.todo.id,
      userId: me.user.id,
      title: "In archived project",
    });

    const live = await createProjectFixture({
      workspaceId: me.workspace.id,
      slug: "live",
    });
    const visible = await insertTask({
      projectId: live.project.id,
      columnId: live.columns.todo.id,
      userId: me.user.id,
      title: "Visible",
    });

    mockAuthenticatedSession(me.user);
    const { app } = createApp();

    const response = await app.request("/api/user/tasks");
    expect(response.status).toBe(200);
    const body = (await response.json()) as AssignedTasksResponse;

    const ids = body.data.tasks.map((task) => task.id);
    expect(ids).toEqual([visible.id]);
    expect(ids).not.toContain(stale.id);
    expect(ids).not.toContain(inArchived.id);
    expect(body.data.projects.map((project) => project.slug)).toEqual(["live"]);
  });

  it("pages the response, first page being the tasks due soonest", async () => {
    const me = await createWorkspaceMember({ userName: "Me" });
    const { project, columns } = await createProjectFixture({
      workspaceId: me.workspace.id,
      slug: "busy",
    });

    // One more than the cap, each due a day later than the previous one, so
    // the one that must fall off is the last by due date.
    const total = MAX_ASSIGNED_TASKS + 1;
    await db.insert(schema.taskTable).values(
      Array.from({ length: total }, (_, index) => ({
        projectId: project.id,
        columnId: columns.todo.id,
        userId: me.user.id,
        title: `Task ${index}`,
        status: "to-do",
        priority: "medium",
        number: index + 1,
        dueDate: new Date(Date.UTC(2026, 8, 1 + index)),
      })),
    );

    mockAuthenticatedSession(me.user);
    const { app } = createApp();

    const response = await app.request("/api/user/tasks");
    expect(response.status).toBe(200);
    const body = (await response.json()) as AssignedTasksResponse;

    expect(body.pagination).toEqual({
      total,
      page: 1,
      pageSize: MAX_ASSIGNED_TASKS,
      totalPages: 2,
    });
    expect(body.data.tasks).toHaveLength(MAX_ASSIGNED_TASKS);
    expect(body.data.tasks.at(-1)?.title).toBe(`Task ${total - 2}`);
    expect(body.data.projects.map((p) => p.slug)).toEqual(["busy"]);
  });

  it("returns empty lists when nothing is assigned to me", async () => {
    const me = await createWorkspaceMember();
    await createProjectFixture({ workspaceId: me.workspace.id });

    mockAuthenticatedSession(me.user);
    const { app } = createApp();

    const response = await app.request("/api/user/tasks");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { tasks: [], projects: [] },
      pagination: {
        total: 0,
        page: 1,
        pageSize: MAX_ASSIGNED_TASKS,
        totalPages: 1,
      },
    });
  });
});
