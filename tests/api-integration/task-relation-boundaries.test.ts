import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { readErrorBody } from "./helpers/error-body";

const m = vi.hoisted(() => ({ publish: vi.fn(async () => undefined) }));
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: m.publish,
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});
async function context() {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Private title", number: 1 })
    .returning();
  return { ...member, task };
}
function request(path: string, method: string, body?: unknown) {
  return createApp().app.request(`/api/task-relation${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}
async function seedRelation(sourceTaskId: string, targetTaskId: string) {
  const [relation] = await db
    .insert(schema.taskRelationTable)
    .values({ sourceTaskId, targetTaskId, relationType: "blocks" })
    .returning();
  return relation;
}

describe("task relation tenant boundaries", () => {
  it("allows only one parent, including simultaneous competing links", async () => {
    const own = await context();
    const [otherParent, child] = await db
      .insert(schema.taskTable)
      .values([
        { projectId: own.task.projectId, title: "Other parent", number: 2 },
        { projectId: own.task.projectId, title: "Child", number: 3 },
      ])
      .returning();
    mockAuthenticatedSession(own.user);
    const link = (sourceTaskId: string) =>
      request("", "POST", {
        sourceTaskId,
        targetTaskId: child.id,
        relationType: "subtask",
      });
    const results = await Promise.all([
      link(own.task.id),
      link(otherParent.id),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      await results.find((response) => response.status === 409)?.json(),
    ).toEqual({
      message: "This task already has a parent",
      code: "CONFLICT",
    });
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(1);
    expect(m.publish).toHaveBeenCalledTimes(1);
    const [relation] = await db.query.taskRelationTable.findMany();
    expect((await request(`/${relation.id}`, "DELETE")).status).toBe(200);
    expect((await link(otherParent.id)).status).toBe(200);
  });

  it("preserves legacy multiple parents while rejecting another parent", async () => {
    const own = await context();
    const [otherParent, newParent, child] = await db
      .insert(schema.taskTable)
      .values([
        { projectId: own.task.projectId, title: "Other parent", number: 2 },
        { projectId: own.task.projectId, title: "New parent", number: 3 },
        { projectId: own.task.projectId, title: "Child", number: 4 },
      ])
      .returning();
    await db.insert(schema.taskRelationTable).values(
      [own.task.id, otherParent.id].map((sourceTaskId) => ({
        sourceTaskId,
        targetTaskId: child.id,
        relationType: "subtask",
      })),
    );
    mockAuthenticatedSession(own.user);
    const response = await request("", "POST", {
      sourceTaskId: newParent.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });
    expect(response.status).toBe(409);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(2);
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("rejects subtask linking and unlinking for read-only members", async () => {
    const member = await createWorkspaceMember({ role: "viewer" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const tasks = await db
      .insert(schema.taskTable)
      .values([
        { projectId: project.id, title: "Parent", number: 1 },
        { projectId: project.id, title: "Child", number: 2 },
      ])
      .returning();
    mockAuthenticatedSession(member.user);
    expect(
      (
        await request("", "POST", {
          sourceTaskId: tasks[0].id,
          targetTaskId: tasks[1].id,
          relationType: "subtask",
        })
      ).status,
    ).toBe(403);
    const [relation] = await db
      .insert(schema.taskRelationTable)
      .values({
        sourceTaskId: tasks[0].id,
        targetTaskId: tasks[1].id,
        relationType: "subtask",
      })
      .returning();
    expect((await request(`/${relation.id}`, "DELETE")).status).toBe(403);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(1);
    expect(m.publish).not.toHaveBeenCalled();
  });

  it("links an existing child and unlinks it without deleting either task", async () => {
    const own = await context();
    const [child] = await db
      .insert(schema.taskTable)
      .values({
        projectId: own.task.projectId,
        title: "Existing child",
        number: 2,
        status: "planned",
      })
      .returning();
    mockAuthenticatedSession(own.user);
    const created = await request("", "POST", {
      sourceTaskId: own.task.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });
    expect(created.status).toBe(200);
    const relation = (await created.json()) as { id: string };
    for (const task of [own.task, child]) {
      const response = await request(`/${task.id}`, "GET");
      expect(await response.json()).toMatchObject([
        {
          sourceTaskId: own.task.id,
          targetTaskId: child.id,
          relationType: "subtask",
        },
      ]);
    }
    expect(m.publish).toHaveBeenCalledWith(
      "task-relation.created",
      expect.objectContaining({
        sourceTaskId: own.task.id,
        targetTaskId: child.id,
      }),
    );
    expect((await request(`/${relation.id}`, "DELETE")).status).toBe(200);
    expect(await db.query.taskTable.findMany()).toHaveLength(2);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(0);
  });

  it("rejects self-links and indirect circular subtask hierarchies", async () => {
    const own = await context();
    const others = await db
      .insert(schema.taskTable)
      .values([
        { projectId: own.task.projectId, title: "Child", number: 2 },
        { projectId: own.task.projectId, title: "Grandchild", number: 3 },
      ])
      .returning();
    mockAuthenticatedSession(own.user);
    const link = (sourceTaskId: string, targetTaskId: string) =>
      request("", "POST", {
        sourceTaskId,
        targetTaskId,
        relationType: "subtask",
      });
    expect((await link(own.task.id, own.task.id)).status).toBe(400);
    expect((await link(own.task.id, others[0].id)).status).toBe(200);
    expect((await link(others[0].id, others[1].id)).status).toBe(200);
    m.publish.mockClear();
    const circular = await link(others[1].id, own.task.id);
    expect(circular.status).toBe(400);
    expect(await circular.json()).toEqual({
      message: "A subtask relation cannot create a circular hierarchy",
      code: "BAD_REQUEST",
    });
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(2);
    expect(m.publish).not.toHaveBeenCalled();
  });

  it("serializes concurrent links that would jointly create a cycle", async () => {
    const own = await context();
    const others = await db
      .insert(schema.taskTable)
      .values([
        { projectId: own.task.projectId, title: "Child", number: 2 },
        { projectId: own.task.projectId, title: "Grandchild", number: 3 },
      ])
      .returning();
    mockAuthenticatedSession(own.user);
    await request("", "POST", {
      sourceTaskId: own.task.id,
      targetTaskId: others[0].id,
      relationType: "subtask",
    });
    const responses = await Promise.all([
      request("", "POST", {
        sourceTaskId: others[0].id,
        targetTaskId: others[1].id,
        relationType: "subtask",
      }),
      request("", "POST", {
        sourceTaskId: others[1].id,
        targetTaskId: own.task.id,
        relationType: "subtask",
      }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(2);
  });

  it("rejects a foreign target and a nonexistent target identically", async () => {
    const own = await context();
    const foreign = await context();
    mockAuthenticatedSession(own.user);
    for (const targetTaskId of [foreign.task.id, "missing-task"]) {
      const response = await request("", "POST", {
        sourceTaskId: own.task.id,
        targetTaskId,
        relationType: "blocks",
      });
      expect(response.status).toBe(404);
      expect(await readErrorBody(response)).toMatchObject({
        message: "Target task not found",
        code: "NOT_FOUND",
      });
    }
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(0);
    expect(m.publish).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "hides legacy cross-workspace relations from reads in either direction (reverse=%s)",
    async (reverse) => {
      const own = await context();
      const foreign = await context();
      await seedRelation(
        reverse ? foreign.task.id : own.task.id,
        reverse ? own.task.id : foreign.task.id,
      );
      for (const member of [own, foreign]) {
        mockAuthenticatedSession(member.user);
        const response = await request(`/${member.task.id}`, "GET");
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([]);
      }
    },
  );

  it("rejects deletion of a legacy foreign-target row without mutation or event", async () => {
    const own = await context();
    const foreign = await context();
    const relation = await seedRelation(own.task.id, foreign.task.id);
    mockAuthenticatedSession(own.user);
    const response = await request(`/${relation.id}`, "DELETE");
    expect(response.status).toBe(404);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Task relation not found",
      code: "NOT_FOUND",
    });
    expect(
      await db.query.taskRelationTable.findFirst({
        where: eq(schema.taskRelationTable.id, relation.id),
      }),
    ).toBeDefined();
    expect(m.publish).not.toHaveBeenCalled();
  });

  it("requires source-workspace access for deletion even when the target is owned", async () => {
    const own = await context();
    const foreign = await context();
    const relation = await seedRelation(foreign.task.id, own.task.id);
    mockAuthenticatedSession(own.user);
    const response = await request(`/${relation.id}`, "DELETE");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Task relation not found");
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(1);
    expect(m.publish).not.toHaveBeenCalled();
  });

  it("keeps same-workspace cross-project relations fully usable", async () => {
    const own = await context();
    const { project } = await createProjectFixture({
      workspaceId: own.workspace.id,
    });
    const [target] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Related", number: 1 })
      .returning();
    mockAuthenticatedSession(own.user);
    const created = await request("", "POST", {
      sourceTaskId: own.task.id,
      targetTaskId: target.id,
      relationType: "related",
    });
    expect(created.status).toBe(200);
    const relation = (await created.json()) as { id: string };
    for (const task of [own.task, target]) {
      const response = await request(`/${task.id}`, "GET");
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject([
        {
          id: relation.id,
          sourceTask: { id: own.task.id },
          targetTask: { id: target.id },
        },
      ]);
    }
    expect((await request(`/${relation.id}`, "DELETE")).status).toBe(200);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(0);
    expect(m.publish).toHaveBeenCalledWith(
      "task-relation.deleted",
      expect.objectContaining({
        sourceTaskId: own.task.id,
        targetTaskId: target.id,
      }),
    );
  });
});
