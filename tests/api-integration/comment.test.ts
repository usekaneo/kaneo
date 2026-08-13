import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: task comments", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("shares comments between the activity UI and comment API", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Shared comments",
        status: "to-do",
        columnId: columns.todo.id,
        priority: "medium",
        number: 1,
        position: 1,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const uiResponse = await app.request("/api/activity/comment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: task.id, comment: "Created in the UI" }),
    });
    expect(uiResponse.status).toBe(200);

    const commentApiResponse = await app.request(`/api/comment/${task.id}`);
    expect(commentApiResponse.status).toBe(200);
    await expect(commentApiResponse.json()).resolves.toEqual([
      expect.objectContaining({
        content: "Created in the UI",
        taskId: task.id,
      }),
    ]);

    const mcpResponse = await app.request(`/api/comment/${task.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Created through MCP" }),
    });
    expect(mcpResponse.status).toBe(200);

    const activityResponse = await app.request(`/api/activity/${task.id}`);
    expect(activityResponse.status).toBe(200);
    const activities = (await activityResponse.json()) as Array<{
      content: string;
      type: string;
    }>;
    expect(activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: "Created in the UI",
          type: "comment",
        }),
        expect.objectContaining({
          content: "Created through MCP",
          type: "comment",
        }),
      ]),
    );

    const storedComments = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, task.id),
          eq(schema.activityTable.type, "comment"),
        ),
      );
    expect(storedComments).toHaveLength(2);

    const legacyComments = await db
      .select()
      .from(schema.commentTable)
      .where(eq(schema.commentTable.taskId, task.id));
    expect(legacyComments).toHaveLength(0);
  });

  it("records an external author when both name and source are given", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Imported",
        status: "to-do",
        columnId: columns.todo.id,
        priority: "medium",
        number: 1,
        position: 1,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const attributed = await app.request(`/api/comment/${task.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: "From PLANKA",
        externalUserName: "Sam",
        externalSource: "planka",
      }),
    });
    expect(attributed.status).toBe(200);

    const [row] = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, task.id));
    expect(row?.externalUserName).toBe("Sam");
    expect(row?.externalSource).toBe("planka");
  });

  it("ignores an external name with no source, so it cannot look like a real user", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Unattributed",
        status: "to-do",
        columnId: columns.todo.id,
        priority: "medium",
        number: 1,
        position: 1,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    await app.request(`/api/comment/${task.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Nice try", externalUserName: "Andrej" }),
    });

    const [row] = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, task.id));
    expect(row?.externalUserName).toBeNull();
  });

  it("rejects an unknown external source", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Bad source",
        status: "to-do",
        columnId: columns.todo.id,
        priority: "medium",
        number: 1,
        position: 1,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/comment/${task.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: "Spoof",
        externalUserName: "Andrej",
        externalSource: "definitely-real",
      }),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
