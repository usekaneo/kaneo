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
    expect(body[1]).toMatchObject({ type: "status_changed", excerpt: null });
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
});
