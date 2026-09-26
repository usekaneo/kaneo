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
    })
    .returning();
  return { ...member, project, columns, task };
}

function baseBody(project: { id: string }) {
  return {
    title: "Original",
    status: "to-do",
    priority: "low",
    projectId: project.id,
    position: 1,
  };
}

describe("task scheduling constraints", () => {
  it("defaults a newly created task to no constraint", async () => {
    const { task } = await setup();
    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(persisted).toMatchObject({
      constraintType: "none",
      constraintDate: null,
    });
  });

  it("sets a start_no_earlier_than constraint through the full-update route, normalizing the date to UTC midnight", async () => {
    const { project, task } = await setup();
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody(project),
        constraintType: "start_no_earlier_than",
        constraintDate: "2026-05-10T14:30:00.000Z",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      constraintType: "start_no_earlier_than",
      constraintDate: "2026-05-10T00:00:00.000Z",
    });

    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(persisted?.constraintDate?.toISOString()).toBe(
      "2026-05-10T00:00:00.000Z",
    );
  });

  it("accepts each of the four valid constraint types", async () => {
    const { project, task } = await setup();
    const { app } = createApp();

    for (const constraintType of [
      "start_no_earlier_than",
      "finish_no_later_than",
      "must_start_on",
    ]) {
      const response = await app.request(`/api/task/${task.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...baseBody(project),
          constraintType,
          constraintDate: "2026-06-01",
        }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ constraintType });
    }

    const backToNone = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody(project),
        constraintType: "none",
      }),
    });
    expect(backToNone.status).toBe(200);
    expect(await backToNone.json()).toMatchObject({
      constraintType: "none",
      constraintDate: null,
    });
  });

  it("rejects an unknown constraint type", async () => {
    const { project, task } = await setup();
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody(project),
        constraintType: "not-a-real-type",
        constraintDate: "2026-06-01",
      }),
    });

    expect(response.status).toBe(400);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ constraintType: "none" });
  });

  it("rejects a non-none constraint type with no constraintDate, without touching the task", async () => {
    const { project, task } = await setup();
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody(project),
        constraintType: "must_start_on",
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("constraintDate");
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ constraintType: "none", constraintDate: null });
  });

  it("forces constraintDate to null when constraintType is set to none, even if a stray date is sent", async () => {
    const { project, task } = await setup();
    const { app } = createApp();

    await db
      .update(schema.taskTable)
      .set({
        constraintType: "finish_no_later_than",
        constraintDate: new Date("2026-05-01T00:00:00.000Z"),
      })
      .where(eq(schema.taskTable.id, task.id));

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody(project),
        constraintType: "none",
        constraintDate: "2026-12-25",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      constraintType: "none",
      constraintDate: null,
    });
  });

  it("preserves an existing constraint on a full update that omits both fields", async () => {
    const { project, task } = await setup();
    const { app } = createApp();

    await db
      .update(schema.taskTable)
      .set({
        constraintType: "must_start_on",
        constraintDate: new Date("2026-05-15T00:00:00.000Z"),
      })
      .where(eq(schema.taskTable.id, task.id));

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody(project),
        title: "Retitled",
      }),
    });

    expect(response.status).toBe(200);
    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(persisted).toMatchObject({
      title: "Retitled",
      constraintType: "must_start_on",
    });
    expect(persisted?.constraintDate?.toISOString()).toBe(
      "2026-05-15T00:00:00.000Z",
    );
  });
});
