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

async function context() {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  return { ...member, project };
}

async function createTask(projectId: string, title: string, number: number) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId, title, number })
    .returning();
  return task;
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

// Seeds a relation directly (bypassing the create endpoint's own guards) so a
// graph shape can be set up without depending on the very logic under test.
async function seedRelation(
  sourceTaskId: string,
  targetTaskId: string,
  relationType: string,
) {
  const [relation] = await db
    .insert(schema.taskRelationTable)
    .values({ sourceTaskId, targetTaskId, relationType })
    .returning();
  return relation;
}

describe("circular dependency detection on POST /task-relation", () => {
  it("rejects a direct 2-cycle ('blocks' A->B, then B->A) with a 409", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);
    const a = await createTask(ctx.project.id, "A", 1);
    const b = await createTask(ctx.project.id, "B", 2);

    const first = await request("", "POST", {
      sourceTaskId: a.id,
      targetTaskId: b.id,
      relationType: "blocks",
    });
    expect(first.status).toBe(200);

    // Caught by the pre-existing duplicate-relation guard (which already
    // treats a reversed source/target pair of the same relationType as a
    // duplicate) rather than by the new cycle check, but the outcome the
    // feature requires — the reverse edge is rejected — still holds.
    const reversed = await request("", "POST", {
      sourceTaskId: b.id,
      targetTaskId: a.id,
      relationType: "blocks",
    });
    expect(reversed.status).toBe(409);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(1);
  });

  it("rejects a transitive 3-cycle ('blocks' A->B->C, then C->A) with the circular-dependency message", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);
    const a = await createTask(ctx.project.id, "A", 1);
    const b = await createTask(ctx.project.id, "B", 2);
    const c = await createTask(ctx.project.id, "C", 3);

    await seedRelation(a.id, b.id, "blocks");
    await seedRelation(b.id, c.id, "blocks");

    const response = await request("", "POST", {
      sourceTaskId: c.id,
      targetTaskId: a.id,
      relationType: "blocks",
    });

    expect(response.status).toBe(409);
    expect(await response.text()).toBe(
      "This dependency would create a circular dependency",
    );
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(2);
    expect(m.publish).not.toHaveBeenCalled();
  });

  it("allows a valid non-cyclic 'blocks' chain (A->B, then B->C)", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);
    const a = await createTask(ctx.project.id, "A", 1);
    const b = await createTask(ctx.project.id, "B", 2);
    const c = await createTask(ctx.project.id, "C", 3);

    await seedRelation(a.id, b.id, "blocks");

    const response = await request("", "POST", {
      sourceTaskId: b.id,
      targetTaskId: c.id,
      relationType: "blocks",
    });

    expect(response.status).toBe(200);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(2);
  });

  it("ignores a legacy cross-workspace edge when checking for cycles (no false positive)", async () => {
    const ownCtx = await context();
    const foreignCtx = await context();
    mockAuthenticatedSession(ownCtx.user);

    const ownA = await createTask(ownCtx.project.id, "Own A", 1);
    const ownB = await createTask(ownCtx.project.id, "Own B", 2);
    const foreignX = await createTask(foreignCtx.project.id, "Foreign X", 1);

    // Legacy/direct-insert cross-workspace edges — a real, workspace-scoped
    // creation could never produce these (see task-relation-boundaries.test.ts).
    // ownA -> foreignX -> ownB forms a path from ownA to ownB *only* if the
    // cycle check fails to scope the graph to the workspace's own tasks.
    await seedRelation(ownA.id, foreignX.id, "blocks");
    await seedRelation(foreignX.id, ownB.id, "blocks");

    const response = await request("", "POST", {
      sourceTaskId: ownB.id,
      targetTaskId: ownA.id,
      relationType: "blocks",
    });

    expect(response.status).toBe(200);
  });

  it("rejects a 'subtask' ancestor cycle (P subtask C, C subtask G, then G subtask P)", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);
    const parent = await createTask(ctx.project.id, "Parent", 1);
    const child = await createTask(ctx.project.id, "Child", 2);
    const grandchild = await createTask(ctx.project.id, "Grandchild", 3);

    expect(
      (
        await request("", "POST", {
          sourceTaskId: parent.id,
          targetTaskId: child.id,
          relationType: "subtask",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request("", "POST", {
          sourceTaskId: child.id,
          targetTaskId: grandchild.id,
          relationType: "subtask",
        })
      ).status,
    ).toBe(200);

    // Making the grandchild the parent of its own ancestor closes the loop:
    // grandchild -> parent -> child -> grandchild.
    const response = await request("", "POST", {
      sourceTaskId: grandchild.id,
      targetTaskId: parent.id,
      relationType: "subtask",
    });

    expect(response.status).toBe(409);
    expect(await response.text()).toBe(
      "This dependency would create a circular dependency",
    );
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(2);
  });

  it("does not apply cycle detection to 'related' relations", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);
    const a = await createTask(ctx.project.id, "A", 1);
    const b = await createTask(ctx.project.id, "B", 2);

    await seedRelation(a.id, b.id, "related");

    // A "related" link is non-directional and has no cycle concept, so the
    // reverse pair is rejected only by the pre-existing duplicate guard, not
    // by the (skipped) cycle check — this still asserts on a distinct pair
    // to prove the cycle check itself never runs for "related".
    const c = await createTask(ctx.project.id, "C", 3);
    await seedRelation(b.id, c.id, "related");

    const response = await request("", "POST", {
      sourceTaskId: c.id,
      targetTaskId: a.id,
      relationType: "related",
    });

    expect(response.status).toBe(200);
  });
});
