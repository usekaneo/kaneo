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

type ScheduledTasksResponse = {
  tasks: Array<{
    id: string;
    title: string;
    projectSlug: string;
    startDate: string | null;
    dueDate: string | null;
    userId: string | null;
  }>;
  total: number;
};

describe("API integration: scheduled tasks", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists dated tasks overlapping the range across active projects, soonest first", async () => {
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
    const [later, soon, startOnly, undated, outsideRange] = await db
      .insert(schema.taskTable)
      .values([
        {
          ...base,
          projectId: web.project.id,
          title: "Due later in range",
          status: "to-do",
          columnId: web.columns.todo.id,
          number: 1,
          dueDate: new Date("2030-01-20T00:00:00.000Z"),
        },
        {
          ...base,
          projectId: api.project.id,
          title: "Due soon",
          status: "in-progress",
          columnId: api.columns.inProgress.id,
          userId: member.user.id,
          number: 1,
          startDate: new Date("2030-01-01T00:00:00.000Z"),
          dueDate: new Date("2030-01-10T00:00:00.000Z"),
        },
        {
          ...base,
          projectId: web.project.id,
          title: "Start only",
          status: "to-do",
          columnId: web.columns.todo.id,
          number: 2,
          startDate: new Date("2030-01-05T00:00:00.000Z"),
        },
        {
          ...base,
          projectId: web.project.id,
          title: "No dates",
          status: "to-do",
          columnId: web.columns.todo.id,
          number: 3,
        },
        {
          ...base,
          projectId: web.project.id,
          title: "Outside range",
          status: "to-do",
          columnId: web.columns.todo.id,
          number: 6,
          dueDate: new Date("2030-03-01T00:00:00.000Z"),
        },
        {
          ...base,
          projectId: web.project.id,
          title: "Archived task",
          status: "archived",
          columnId: web.columns.todo.id,
          number: 4,
          dueDate: new Date("2030-01-02T00:00:00.000Z"),
        },
        {
          ...base,
          projectId: archived.project.id,
          title: "In archived project",
          status: "to-do",
          columnId: archived.columns.todo.id,
          number: 1,
          dueDate: new Date("2030-01-03T00:00:00.000Z"),
        },
        {
          ...base,
          projectId: web.project.id,
          title: "Someone else's undated",
          status: "to-do",
          columnId: web.columns.todo.id,
          userId: other.user.id,
          number: 5,
        },
      ])
      .returning();

    void undated;
    void outsideRange;

    const { app } = createApp();
    mockAuthenticatedSession(member.user);
    const response = await app.request(
      `/api/task/scheduled?workspaceId=${member.workspace.id}&from=2030-01-01T00:00:00.000Z&to=2030-01-31T23:59:59.999Z`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as ScheduledTasksResponse;

    expect(body.total).toBe(3);
    expect(body.tasks.map((task) => task.title)).toEqual([
      soon.title,
      startOnly.title,
      later.title,
    ]);
    expect(body.tasks[0]?.projectSlug).toBe("api");
    expect(body.tasks[0]?.startDate).toBeTruthy();
    expect(body.tasks[0]?.dueDate).toBeTruthy();
  });

  it("filters to the caller's assigned tasks when assignedToMe=true", async () => {
    const member = await createWorkspaceMember();
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const project = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "web",
    });

    const base = {
      priority: "medium",
      position: 1,
      status: "to-do",
      columnId: project.columns.todo.id,
      projectId: project.project.id,
      dueDate: new Date("2030-01-15T00:00:00.000Z"),
    };
    const [mine] = await db
      .insert(schema.taskTable)
      .values([
        {
          ...base,
          title: "Mine",
          userId: member.user.id,
          number: 1,
        },
        {
          ...base,
          title: "Theirs",
          userId: other.user.id,
          number: 2,
        },
      ])
      .returning();

    const { app } = createApp();
    mockAuthenticatedSession(member.user);
    const response = await app.request(
      `/api/task/scheduled?workspaceId=${member.workspace.id}&from=2030-01-01T00:00:00.000Z&to=2030-01-31T23:59:59.999Z&assignedToMe=true`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as ScheduledTasksResponse;

    expect(body.total).toBe(1);
    expect(body.tasks.map((task) => task.title)).toEqual([mine.title]);
    expect(body.tasks[0]?.userId).toBe(member.user.id);
  });

  it("rejects an inverted from/to range", async () => {
    const member = await createWorkspaceMember();
    const { app } = createApp();
    mockAuthenticatedSession(member.user);
    const response = await app.request(
      `/api/task/scheduled?workspaceId=${member.workspace.id}&from=2030-02-01T00:00:00.000Z&to=2030-01-01T00:00:00.000Z`,
    );
    expect(response.status).toBe(400);
  });
});
