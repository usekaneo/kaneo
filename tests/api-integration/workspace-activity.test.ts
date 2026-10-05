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

type WorkspaceActivityResponse = Array<{
  type: string;
  excerpt: string | null;
  content?: string;
  userName: string | null;
  taskTitle: string;
  projectSlug: string;
  eventData: Record<string, unknown> | null;
}>;

const DAY = 24 * 60 * 60 * 1000;

describe("API integration: workspace activity", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("returns recent activity across the workspace, newest first", async () => {
    const member = await createWorkspaceMember({ userName: "Mira" });
    const elsewhere = await createWorkspaceMember();
    const web = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "web",
    });
    await db
      .update(schema.columnTable)
      .set({ name: "Queued for QA" })
      .where(eq(schema.columnTable.id, web.columns.todo.id));
    const foreign = await createProjectFixture({
      workspaceId: elsewhere.workspace.id,
      slug: "foreign",
    });

    const [task, foreignTask] = await db
      .insert(schema.taskTable)
      .values([
        {
          projectId: web.project.id,
          title: "Fix reconnect loop",
          status: "to-do",
          columnId: web.columns.todo.id,
          priority: "high",
          number: 1,
          position: 1,
        },
        {
          projectId: foreign.project.id,
          title: "Another workspace's task",
          status: "to-do",
          columnId: foreign.columns.todo.id,
          priority: "low",
          number: 1,
          position: 1,
        },
      ])
      .returning();

    const now = Date.now();
    await db.insert(schema.activityTable).values([
      {
        taskId: task.id,
        type: "status_changed",
        userId: member.user.id,
        eventData: { oldStatus: "to-do", newStatus: "in-progress" },
        createdAt: new Date(now - 2 * DAY),
      },
      {
        taskId: task.id,
        type: "comment",
        userId: member.user.id,
        content: 'Reproduced <kaneo-mention id="u">@Alex</kaneo-mention>',
        createdAt: new Date(now - DAY),
      },
      {
        taskId: task.id,
        type: "comment",
        userId: member.user.id,
        content: "Too old to show",
        createdAt: new Date(now - 45 * DAY),
      },
      {
        taskId: foreignTask.id,
        type: "comment",
        userId: elsewhere.user.id,
        content: "Private to another workspace",
        createdAt: new Date(now),
      },
    ]);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/activity/workspace/${member.workspace.id}`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkspaceActivityResponse;

    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      type: "comment",
      excerpt: "Reproduced @Alex",
      userName: "Mira",
      taskTitle: "Fix reconnect loop",
      projectSlug: "web",
    });
    expect(body[0]).not.toHaveProperty("content");
    expect(body[1]).toMatchObject({
      type: "status_changed",
      excerpt: null,
      eventData: {
        oldStatus: "to-do",
        newStatus: "in-progress",
        oldStatusName: "Queued for QA",
        newStatusName: "In Progress",
      },
    });
  });

  it("refuses a workspace the caller does not belong to", async () => {
    const member = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();

    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/activity/workspace/${member.workspace.id}`,
    );
    expect(response.status).toBe(403);
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
        `/api/activity/workspace/${member.workspace.id}`,
      );
      expect(response.status).toBe(403);
    },
  );

  it("bounds an inbox preview while preserving full task history", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Busy task", status: "to-do" })
      .returning();
    const now = Date.now();
    await db.insert(schema.activityTable).values(
      Array.from({ length: 15 }, (_, i) => ({
        taskId: task.id,
        type: "comment",
        content: `Comment ${i}`,
        createdAt: new Date(now - i * 1000),
      })),
    );
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const preview = await app.request(`/api/activity/${task.id}?limit=6`);
    expect(preview.status).toBe(200);
    expect(
      (await preview.json()).map((event: { content: string }) => event.content),
    ).toEqual(Array.from({ length: 6 }, (_, i) => `Comment ${i}`));
    const full = await app.request(`/api/activity/${task.id}`);
    expect(full.status).toBe(200);
    expect(await full.json()).toHaveLength(15);
    for (const limit of ["0", "101", "abc"]) {
      const invalid = await app.request(
        `/api/activity/${task.id}?limit=${limit}`,
      );
      expect(invalid.status).toBe(400);
    }
  });
  it("does not guess a historical column name when its status slug is ambiguous", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db.insert(schema.columnTable).values({
      projectId: project.id,
      slug: columns.todo.slug,
      name: "Other queue",
      position: -1,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Historical status",
        status: "in-progress",
        columnId: columns.inProgress.id,
      })
      .returning();
    await db.insert(schema.activityTable).values({
      taskId: task.id,
      type: "status_changed",
      eventData: {
        oldStatus: columns.todo.slug,
        newStatus: columns.inProgress.slug,
      },
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/activity/workspace/${member.workspace.id}`,
    );
    expect(response.status).toBe(200);
    const [event] = await response.json();
    expect(event.eventData).not.toHaveProperty("oldStatusName");
    expect(event.eventData).toMatchObject({
      oldStatus: "to-do",
      newStatusName: "In Progress",
    });
  });
});
