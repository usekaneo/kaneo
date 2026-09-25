import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const m = vi.hoisted(() => ({ publish: vi.fn(async () => undefined) }));
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: m.publish,
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

function deleteTask(id: string) {
  return createApp().app.request(`/api/task/${id}`, { method: "DELETE" });
}

// Deleting a task cascade-deletes its relations. The relation's own project
// (the deleted task's project) has always gotten an event; the OTHER,
// cross-project relation endpoint's project must get one too, or its
// Gantt/dependency cache never learns the far task (and the relation to it)
// is gone.
describe("deleting a task with a cross-project relation", () => {
  it("publishes task-relation.deleted for both the deleted task's project and the other end's project", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project: projectA } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const { project: projectB } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const [taskA] = await db
      .insert(schema.taskTable)
      .values({ projectId: projectA.id, title: "Task A", number: 1 })
      .returning();
    const [taskB] = await db
      .insert(schema.taskTable)
      .values({ projectId: projectB.id, title: "Task B", number: 1 })
      .returning();
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: taskA.id,
      targetTaskId: taskB.id,
      relationType: "blocks",
    });

    mockAuthenticatedSession(member.user);
    const response = await deleteTask(taskA.id);
    expect(response.status).toBe(200);

    const relationDeletedCalls = m.publish.mock.calls.filter(
      ([eventName]) => eventName === "task-relation.deleted",
    );
    const notifiedProjectIds = relationDeletedCalls.map(
      ([, payload]) => (payload as { projectId: string }).projectId,
    );
    expect(notifiedProjectIds).toContain(projectA.id);
    expect(notifiedProjectIds).toContain(projectB.id);
    for (const [, payload] of relationDeletedCalls) {
      expect(payload).toMatchObject({
        sourceTaskId: taskA.id,
        targetTaskId: taskB.id,
      });
    }
  });

  it("publishes only once for a same-project relation (no duplicate event for the same project)", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const [taskA] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Task A", number: 1 })
      .returning();
    const [taskB] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Task B", number: 2 })
      .returning();
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: taskA.id,
      targetTaskId: taskB.id,
      relationType: "related",
    });

    mockAuthenticatedSession(member.user);
    const response = await deleteTask(taskA.id);
    expect(response.status).toBe(200);

    const relationDeletedCalls = m.publish.mock.calls.filter(
      ([eventName]) => eventName === "task-relation.deleted",
    );
    expect(relationDeletedCalls).toHaveLength(1);
    expect(relationDeletedCalls[0]?.[1]).toMatchObject({
      projectId: project.id,
    });
  });
});
