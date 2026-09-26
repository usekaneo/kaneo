import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: vi.fn(async () => undefined),
}));

beforeEach(async () => {
  await resetTestDatabase();
});

async function setup() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Original",
      status: "to-do",
      priority: "low",
      number: 1,
      position: 1,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      dueDate: new Date("2026-04-05T00:00:00.000Z"),
      progress: 25,
      isMilestone: false,
    })
    .returning();
  return { ...member, project, columns, task };
}

describe("task progress, milestone, and baseline", () => {
  it("creates a task with progress and isMilestone, defaulting when omitted", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const withDefaults = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "No progress fields",
        description: "",
        priority: "low",
        status: "to-do",
      }),
    });
    expect(withDefaults.status).toBe(200);
    expect(await withDefaults.json()).toMatchObject({
      progress: 0,
      isMilestone: false,
    });

    const withValues = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "With progress fields",
        description: "",
        priority: "low",
        status: "to-do",
        progress: 60,
        isMilestone: true,
      }),
    });
    expect(withValues.status).toBe(200);
    expect(await withValues.json()).toMatchObject({
      progress: 60,
      isMilestone: true,
    });
  });

  it("rejects out-of-range progress on create with a clear error, without creating the task", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Bad progress",
        description: "",
        priority: "low",
        status: "to-do",
        progress: 150,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("progress");

    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.title, "Bad progress"),
    });
    expect(persisted).toBeUndefined();
  });

  it("rejects out-of-range progress on full update without touching the task", async () => {
    const { project, task } = await setup();
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Original",
        status: "to-do",
        priority: "low",
        projectId: project.id,
        position: 1,
        progress: -5,
      }),
    });

    expect(response.status).toBe(400);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ progress: 25 });
  });

  it("updates progress and isMilestone through the full-update route", async () => {
    const { project, task } = await setup();
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Original",
        status: "to-do",
        priority: "low",
        projectId: project.id,
        position: 1,
        progress: 100,
        isMilestone: true,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      progress: 100,
      isMilestone: true,
    });
  });

  it("preserves progress and isMilestone on a full update that omits them", async () => {
    const { project, task } = await setup();
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Retitled",
        status: "to-do",
        priority: "low",
        projectId: project.id,
        position: 1,
      }),
    });

    expect(response.status).toBe(200);
    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(persisted).toMatchObject({ title: "Retitled", progress: 25 });
  });

  it("sets and clears a task baseline from its current dates", async () => {
    const { task } = await setup();
    const { app } = createApp();

    const setResponse = await app.request(`/api/task/${task.id}/baseline`, {
      method: "POST",
    });
    expect(setResponse.status).toBe(200);
    const setPayload = (await setResponse.json()) as {
      baselineStartDate: string | null;
      baselineDueDate: string | null;
    };
    expect(setPayload.baselineStartDate).toBe("2026-04-01T00:00:00.000Z");
    expect(setPayload.baselineDueDate).toBe("2026-04-05T00:00:00.000Z");

    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(persisted?.baselineStartDate?.toISOString()).toBe(
      "2026-04-01T00:00:00.000Z",
    );
    expect(persisted?.baselineDueDate?.toISOString()).toBe(
      "2026-04-05T00:00:00.000Z",
    );

    const clearResponse = await app.request(`/api/task/${task.id}/baseline`, {
      method: "DELETE",
    });
    expect(clearResponse.status).toBe(200);
    expect(await clearResponse.json()).toMatchObject({
      baselineStartDate: null,
      baselineDueDate: null,
    });

    const cleared = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(cleared?.baselineStartDate).toBeNull();
    expect(cleared?.baselineDueDate).toBeNull();
  });

  it("requires task:update permission to set or clear a baseline", async () => {
    const viewer = await createWorkspaceMember({ role: "viewer" });
    const { project, columns } = await createProjectFixture({
      workspaceId: viewer.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        columnId: columns.todo.id,
        title: "Viewer's task",
        status: "to-do",
        priority: "low",
        number: 1,
        position: 1,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        dueDate: new Date("2026-04-05T00:00:00.000Z"),
      })
      .returning();
    mockAuthenticatedSession(viewer.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}/baseline`, {
      method: "POST",
    });

    expect(response.status).toBe(403);
    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(persisted?.baselineStartDate).toBeNull();
  });
});
