import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: task creation", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated task creation requests", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Unauthorized task",
        description: "Should not be created",
        priority: "low",
        status: "to-do",
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Unauthorized");
  });

  it("creates a task with the matching column, assignee, and next number", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Delivery",
      slug: "delivery",
    });

    await db.insert(schema.taskTable).values({
      projectId: project.id,
      userId: member.user.id,
      title: "Existing task",
      description: "Already there",
      status: "to-do",
      columnId: columns.todo.id,
      priority: "medium",
      number: 1,
      position: 1,
    });
    await db
      .update(schema.projectTable)
      .set({ lastTaskNumber: 1 })
      .where(eq(schema.projectTable.id, project.id));

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Ship integration flow",
        description: "Cover the first create-task path",
        priority: "high",
        status: "to-do",
        userId: member.user.id,
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      projectId: string;
      title: string;
      description: string;
      priority: string;
      status: string;
      userId: string | null;
      number: number | null;
      position: number | null;
      assigneeName?: string;
    };

    expect(payload).toMatchObject({
      projectId: project.id,
      title: "Ship integration flow",
      description: "Cover the first create-task path",
      priority: "high",
      status: "to-do",
      userId: member.user.id,
      number: 2,
      position: 2,
      assigneeName: member.user.name,
    });

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, payload.id),
    });

    expect(persistedTask).toMatchObject({
      id: payload.id,
      projectId: project.id,
      columnId: columns.todo.id,
      userId: member.user.id,
      title: "Ship integration flow",
      priority: "high",
      status: "to-do",
      number: 2,
      position: 2,
    });
  });

  it("rejects task creation for users outside the project workspace", async () => {
    const member = await createWorkspaceMember();
    const outsiderId = `user-${randomUUID()}`;
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const [outsider] = await db
      .insert(schema.userTable)
      .values({
        id: outsiderId,
        email: `${outsiderId}@example.com`,
        emailVerified: true,
        name: "Task Outsider",
      })
      .returning();

    mockAuthenticatedSession(outsider);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Forbidden task",
        description: "Should not be created",
        priority: "low",
        status: "to-do",
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe(
      "You don't have access to this workspace",
    );

    const persistedTask = await db.query.taskTable.findFirst({
      where: and(
        eq(schema.taskTable.projectId, project.id),
        eq(schema.taskTable.title, "Forbidden task"),
      ),
    });

    expect(persistedTask).toBeUndefined();
  });

  it("creates an unassigned task with parsed dates when optional fields are provided", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Plan release cut",
        description: "Track optional fields too",
        priority: "medium",
        status: "in-progress",
        startDate: "2026-04-01T09:00:00.000Z",
        dueDate: "2026-04-05T17:00:00.000Z",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      userId: string | null;
      columnId: string | null;
      startDate: string | null;
      dueDate: string | null;
      assigneeName?: string;
    };

    expect(payload).toMatchObject({
      userId: null,
      columnId: columns.inProgress.id,
      startDate: "2026-04-01T09:00:00.000Z",
      dueDate: "2026-04-05T17:00:00.000Z",
    });
    expect(payload.assigneeName).toBeUndefined();

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, payload.id),
    });

    expect(persistedTask).toMatchObject({
      id: payload.id,
      userId: null,
      columnId: columns.inProgress.id,
      status: "in-progress",
    });
    expect(persistedTask?.startDate?.toISOString()).toBe(
      "2026-04-01T09:00:00.000Z",
    );
    expect(persistedTask?.dueDate?.toISOString()).toBe(
      "2026-04-05T17:00:00.000Z",
    );
  });

  it("creates tasks without a column when the status has no matching project column", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Future status task",
        description: "Status does not map to a seeded column",
        priority: "low",
        status: "planned",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      status: string;
      columnId: string | null;
      position: number | null;
    };

    expect(payload).toMatchObject({
      status: "planned",
      columnId: null,
      position: 1,
    });

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, payload.id),
    });

    expect(persistedTask).toMatchObject({
      id: payload.id,
      status: "planned",
      columnId: null,
      position: 1,
    });
  });

  it("rejects task creation for an assignee that cannot be assigned, without revealing whether the user exists", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const missingAssigneeId = `user-${randomUUID()}`;

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Ghost assignee task",
        description: "Should fail because the assignee does not exist",
        priority: "low",
        status: "to-do",
        userId: missingAssigneeId,
      }),
    });

    // A missing user and a non-member both answer 403 with the same message, so
    // the endpoint cannot be used to probe which user ids exist.
    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toContain(
      "Assignee is not a member of this workspace",
    );

    const persistedTask = await db.query.taskTable.findFirst({
      where: and(
        eq(schema.taskTable.projectId, project.id),
        eq(schema.taskTable.title, "Ghost assignee task"),
      ),
    });

    expect(persistedTask).toBeUndefined();
  });

  it("creates a task when the assignee userId is surrounded by whitespace", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const paddedAssigneeId = `  ${member.user.id}  `;

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Padded assignee task",
        description: "Whitespace around userId should be trimmed",
        priority: "medium",
        status: "to-do",
        userId: paddedAssigneeId,
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      userId: string;
      assigneeName?: string;
    };

    expect(payload.userId).toBe(member.user.id);
    expect(payload.assigneeName).toBe(member.user.name);

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, payload.id),
    });

    expect(persistedTask).toMatchObject({
      id: payload.id,
      projectId: project.id,
      columnId: columns.todo.id,
      userId: member.user.id,
      title: "Padded assignee task",
    });
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
  ])(
    "creates an unassigned task when the assignee userId is %s",
    async (label, userId) => {
      const member = await createWorkspaceMember();
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const title = `Blank assignee task (${label})`;
      const response = await app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title,
          description: "Blank userId means unassigned",
          priority: "low",
          status: "to-do",
          userId,
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        userId: string | null;
        assigneeName?: string;
      };

      expect(payload.userId).toBeNull();
      expect(payload.assigneeName).toBeUndefined();

      const persistedTask = await db.query.taskTable.findFirst({
        where: and(
          eq(schema.taskTable.projectId, project.id),
          eq(schema.taskTable.title, title),
        ),
      });

      expect(persistedTask?.userId).toBeNull();
    },
  );
});

describe("API integration: task time estimate", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function createTask(
    app: ReturnType<typeof createApp>["app"],
    projectId: string,
    body: Record<string, unknown>,
  ) {
    const response = await app.request(`/api/task/${projectId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(200);
    return (await response.json()) as {
      id: string;
      timeEstimate: number | null;
    };
  }

  it("sets and clears a task time estimate in seconds", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const created = await createTask(app, project.id, {
      title: "Estimated task",
      description: "Has a time estimate",
      priority: "medium",
      status: "to-do",
      timeEstimate: 9000,
    });

    expect(created.timeEstimate).toBe(9000);

    const setResponse = await app.request(
      `/api/task/time-estimate/${created.id}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ timeEstimate: 5400 }),
      },
    );

    expect(setResponse.status).toBe(200);
    await expect(setResponse.json()).resolves.toMatchObject({
      id: created.id,
      timeEstimate: 5400,
    });

    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, created.id),
    });
    expect(persisted?.timeEstimate).toBe(5400);

    // Event subscribers run detached from the request (EventEmitter does not
    // await async listeners), so poll until the activity row lands.
    await vi.waitFor(async () => {
      const rows = await db
        .select()
        .from(schema.activityTable)
        .where(
          and(
            eq(schema.activityTable.taskId, created.id),
            eq(schema.activityTable.type, "time_estimate_changed"),
          ),
        );

      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, created.id),
          eq(schema.activityTable.type, "time_estimate_changed"),
        ),
      );

    expect(activities[activities.length - 1]).toMatchObject({
      taskId: created.id,
      userId: member.user.id,
      type: "time_estimate_changed",
      eventData: {
        oldTimeEstimate: 9000,
        newTimeEstimate: 5400,
      },
    });

    const clearResponse = await app.request(
      `/api/task/time-estimate/${created.id}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ timeEstimate: null }),
      },
    );

    expect(clearResponse.status).toBe(200);
    await expect(clearResponse.json()).resolves.toMatchObject({
      id: created.id,
      timeEstimate: null,
    });

    const cleared = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, created.id),
    });
    expect(cleared?.timeEstimate).toBeNull();

    await vi.waitFor(async () => {
      const rows = await db
        .select()
        .from(schema.activityTable)
        .where(
          and(
            eq(schema.activityTable.taskId, created.id),
            eq(schema.activityTable.type, "time_estimate_changed"),
          ),
        );

      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[rows.length - 1]).toMatchObject({
        type: "time_estimate_changed",
        eventData: {
          oldTimeEstimate: 5400,
          newTimeEstimate: null,
        },
      });
    });
  });

  it("applies a time estimate to many tasks with bulk update", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const first = await createTask(app, project.id, {
      title: "Bulk estimate one",
      description: "First bulk task",
      priority: "low",
      status: "to-do",
    });
    const second = await createTask(app, project.id, {
      title: "Bulk estimate two",
      description: "Second bulk task",
      priority: "low",
      status: "to-do",
    });

    const response = await app.request("/api/task/bulk", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        taskIds: [first.id, second.id],
        operation: "updateTimeEstimate",
        value: "3600",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      updatedCount: 2,
    });

    const persisted = await db.query.taskTable.findMany({
      where: eq(schema.taskTable.projectId, project.id),
    });
    expect(persisted.map((task) => task.timeEstimate).sort()).toEqual([
      3600, 3600,
    ]);

    await vi.waitFor(async () => {
      const rows = await db
        .select()
        .from(schema.activityTable)
        .where(eq(schema.activityTable.type, "time_estimate_changed"));

      expect(rows).toHaveLength(2);
    });

    const clearResponse = await app.request("/api/task/bulk", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        taskIds: [first.id, second.id],
        operation: "updateTimeEstimate",
        value: null,
      }),
    });

    expect(clearResponse.status).toBe(200);
    const cleared = await db.query.taskTable.findMany({
      where: eq(schema.taskTable.projectId, project.id),
    });
    expect(cleared.map((task) => task.timeEstimate)).toEqual([null, null]);
  });

  it("rejects a negative time estimate", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const created = await createTask(app, project.id, {
      title: "Invalid estimate task",
      description: "Negative estimate should fail",
      priority: "low",
      status: "to-do",
    });

    const response = await app.request(
      `/api/task/time-estimate/${created.id}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ timeEstimate: -5 }),
      },
    );

    expect(response.status).toBe(400);

    const persistedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, created.id),
    });
    expect(persistedTask?.timeEstimate).toBeNull();

    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, created.id),
          eq(schema.activityTable.type, "time_estimate_changed"),
        ),
      );
    expect(activities).toHaveLength(0);
  });

  it("preserves the estimate through a full task update", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const created = await createTask(app, project.id, {
      title: "Full update task",
      description: "Estimate must survive full replaces",
      priority: "medium",
      status: "to-do",
      timeEstimate: 7200,
    });

    const response = await app.request(`/api/task/${created.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Full update task",
        description: "Estimate must survive full replaces",
        priority: "medium",
        status: "to-do",
        projectId: project.id,
        position: 1,
        timeEstimate: 7200,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: created.id,
      timeEstimate: 7200,
    });
  });

  it("rejects unauthenticated time estimate updates", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const created = await createTask(app, project.id, {
      title: "Auth estimate task",
      description: "Estimate updates need a session",
      priority: "low",
      status: "to-do",
    });

    mockAnonymousSession();
    const response = await app.request(
      `/api/task/time-estimate/${created.id}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ timeEstimate: 3600 }),
      },
    );

    expect(response.status).toBe(401);
  });
});
