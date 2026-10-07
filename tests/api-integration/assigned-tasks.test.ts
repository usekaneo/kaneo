import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type AssignedTasksResponse = {
  tasks: Array<{
    id: string;
    title: string;
    projectSlug: string;
    statusName: string | null;
    labels: Array<{ name: string }>;
  }>;
  total: number;
};

describe("API integration: assigned tasks", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists the caller's open tasks across projects, soonest due first", async () => {
    const member = await createWorkspaceMember();
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });

    const web = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "web",
    });
    const api = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "api",
    });
    const archived = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "old",
    });
    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.projectTable.id, archived.project.id));

    const base = { priority: "medium", position: 1 };
    const [later, soon, undated] = await db
      .insert(schema.taskTable)
      .values([
        {
          ...base,
          projectId: web.project.id,
          title: "Due later",
          status: "to-do",
          columnId: web.columns.todo.id,
          userId: member.user.id,
          number: 1,
          dueDate: new Date("2030-02-01T00:00:00.000Z"),
        },
        {
          ...base,
          projectId: api.project.id,
          title: "Due soon",
          status: "in-progress",
          columnId: api.columns.inProgress.id,
          userId: member.user.id,
          number: 1,
          dueDate: new Date("2030-01-01T00:00:00.000Z"),
        },
        {
          ...base,
          projectId: web.project.id,
          title: "No due date",
          status: "to-do",
          columnId: web.columns.todo.id,
          userId: member.user.id,
          number: 2,
        },
        {
          ...base,
          projectId: web.project.id,
          title: "Already done",
          status: "done",
          columnId: web.columns.done.id,
          userId: member.user.id,
          number: 3,
        },
        {
          ...base,
          projectId: web.project.id,
          title: "Archived task",
          status: "archived",
          userId: member.user.id,
          number: 4,
        },
        {
          ...base,
          projectId: web.project.id,
          title: "Someone else's",
          status: "to-do",
          columnId: web.columns.todo.id,
          userId: other.user.id,
          number: 5,
        },
        {
          ...base,
          projectId: archived.project.id,
          title: "In an archived project",
          status: "to-do",
          columnId: archived.columns.todo.id,
          userId: member.user.id,
          number: 1,
        },
      ])
      .returning();
    await db.insert(schema.labelTable).values({
      name: "Bug",
      color: "red",
      taskId: soon.id,
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/task/assigned?workspaceId=${member.workspace.id}`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as AssignedTasksResponse;

    expect(body.total).toBe(3);
    const countResponse = await app.request(
      `/api/task/assigned?workspaceId=${member.workspace.id}&countOnly=true`,
    );
    expect(countResponse.status).toBe(200);
    expect(await countResponse.json()).toEqual({ tasks: [], total: 3 });
    expect(body.tasks.map((task) => task.id)).toEqual([
      soon.id,
      later.id,
      undated.id,
    ]);
    expect(body.tasks[0]).toMatchObject({
      projectSlug: "api",
      statusName: "In Progress",
      labels: [expect.objectContaining({ name: "Bug" })],
    });
  });

  it("uses column references when duplicate slugs include final columns", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [finalColumn] = await db
      .insert(schema.columnTable)
      .values({
        projectId: project.id,
        name: "Duplicate to-do",
        slug: columns.todo.slug,
        position: -1,
        isFinal: true,
      })
      .returning();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Once only",
        status: columns.todo.slug,
        columnId: columns.todo.id,
        userId: member.user.id,
      })
      .returning();
    await db.insert(schema.taskTable).values([
      {
        projectId: project.id,
        title: "In the final duplicate",
        status: columns.todo.slug,
        columnId: finalColumn.id,
        userId: member.user.id,
        number: 2,
      },
      {
        projectId: project.id,
        title: "Legacy ambiguous status",
        status: columns.todo.slug,
        userId: member.user.id,
        number: 3,
      },
    ]);
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const countResponse = await app.request(
      `/api/task/assigned?workspaceId=${member.workspace.id}&countOnly=true`,
    );
    expect(await countResponse.json()).toEqual({ tasks: [], total: 1 });
    const response = await app.request(
      `/api/task/assigned?workspaceId=${member.workspace.id}`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as AssignedTasksResponse;
    expect(body.total).toBe(1);
    const details = await app.request(`/api/task/${task.id}`);
    expect(details.status).toBe(200);
    expect(await details.json()).toMatchObject({
      id: task.id,
      columnId: columns.todo.id,
      workspaceId: member.workspace.id,
    });
    expect(body.tasks).toEqual([
      expect.objectContaining({ id: task.id, statusName: columns.todo.name }),
    ]);
  });

  it("refuses a workspace the caller does not belong to", async () => {
    const member = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();

    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    for (const countOnly of ["false", "true"]) {
      const response = await app.request(
        `/api/task/assigned?workspaceId=${member.workspace.id}&countOnly=${countOnly}`,
      );
      expect(response.status).toBe(404);
    }
  });
  it.each([
    { workspace: ["read"] },
    { workspace: ["read"], project: ["read"] },
    { workspace: ["read"], task: ["read"] },
  ])(
    "rejects members missing project or task read permission (%j)",
    async (permissions) => {
      const member = await createWorkspaceMember({ role: "limited" });
      await db.insert(schema.workspaceRoleTable).values({
        workspaceId: member.workspace.id,
        role: "limited",
        permission: JSON.stringify(permissions),
      });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();
      const response = await app.request(
        `/api/task/assigned?workspaceId=${member.workspace.id}`,
      );
      expect(response.status).toBe(403);
      const count = await app.request(
        `/api/task/assigned?workspaceId=${member.workspace.id}&countOnly=true`,
      );
      expect(count.status).toBe(403);
    },
  );
});
