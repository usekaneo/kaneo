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
  const [sourceTask] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Source", number: 1 })
    .returning();
  const [targetTask] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Target", number: 2 })
    .returning();
  return { ...member, sourceTask, targetTask };
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

describe("POST /task-relation — dependencyType/lagDays", () => {
  it("persists a 'blocks' relation's dependency type and lag", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);

    const response = await request("", "POST", {
      sourceTaskId: ctx.sourceTask.id,
      targetTaskId: ctx.targetTask.id,
      relationType: "blocks",
      dependencyType: "ss",
      lagDays: 3,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      dependencyType: string;
      lagDays: number;
    };
    expect(body.dependencyType).toBe("ss");
    expect(body.lagDays).toBe(3);

    const [stored] = await db.query.taskRelationTable.findMany();
    expect(stored).toMatchObject({ dependencyType: "ss", lagDays: 3 });
  });

  it("defaults a 'blocks' relation with no dependencyType/lagDays to fs/0", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);

    const response = await request("", "POST", {
      sourceTaskId: ctx.sourceTask.id,
      targetTaskId: ctx.targetTask.id,
      relationType: "blocks",
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      dependencyType: string;
      lagDays: number;
    };
    expect(body.dependencyType).toBe("fs");
    expect(body.lagDays).toBe(0);
  });

  it("ignores a supplied dependencyType/lagDays for a non-'blocks' relation, storing fs/0", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);

    const response = await request("", "POST", {
      sourceTaskId: ctx.sourceTask.id,
      targetTaskId: ctx.targetTask.id,
      relationType: "related",
      dependencyType: "ff",
      lagDays: 7,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      dependencyType: string;
      lagDays: number;
    };
    expect(body.dependencyType).toBe("fs");
    expect(body.lagDays).toBe(0);
  });

  it("rejects an invalid dependencyType with a 400", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);

    const response = await request("", "POST", {
      sourceTaskId: ctx.sourceTask.id,
      targetTaskId: ctx.targetTask.id,
      relationType: "blocks",
      dependencyType: "not-a-type",
    });

    expect(response.status).toBe(400);
  });
});

describe("PATCH /task-relation/{id}", () => {
  it("updates a 'blocks' relation's dependency type and lag", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);

    const [relation] = await db
      .insert(schema.taskRelationTable)
      .values({
        sourceTaskId: ctx.sourceTask.id,
        targetTaskId: ctx.targetTask.id,
        relationType: "blocks",
      })
      .returning();

    const response = await request(`/${relation.id}`, "PATCH", {
      dependencyType: "ff",
      lagDays: -2,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      dependencyType: string;
      lagDays: number;
    };
    expect(body.dependencyType).toBe("ff");
    expect(body.lagDays).toBe(-2);

    const [stored] = await db.query.taskRelationTable.findMany();
    expect(stored).toMatchObject({ dependencyType: "ff", lagDays: -2 });
  });

  it("rejects updating a 'related' relation's dependency type/lag with a 400", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);

    const [relation] = await db
      .insert(schema.taskRelationTable)
      .values({
        sourceTaskId: ctx.sourceTask.id,
        targetTaskId: ctx.targetTask.id,
        relationType: "related",
      })
      .returning();

    const response = await request(`/${relation.id}`, "PATCH", {
      dependencyType: "ff",
    });

    expect(response.status).toBe(400);
  });

  it("rejects a foreign relation with a 403, matching delete's tenant boundary (scopeToRelation denies workspace access before the 404 the handler itself would raise)", async () => {
    const own = await context();
    const foreign = await context();

    const [relation] = await db
      .insert(schema.taskRelationTable)
      .values({
        sourceTaskId: foreign.sourceTask.id,
        targetTaskId: foreign.targetTask.id,
        relationType: "blocks",
      })
      .returning();

    mockAuthenticatedSession(own.user);
    const response = await request(`/${relation.id}`, "PATCH", {
      lagDays: 1,
    });

    expect(response.status).toBe(403);
  });

  it("rejects an empty update body with a 400", async () => {
    const ctx = await context();
    mockAuthenticatedSession(ctx.user);

    const [relation] = await db
      .insert(schema.taskRelationTable)
      .values({
        sourceTaskId: ctx.sourceTask.id,
        targetTaskId: ctx.targetTask.id,
        relationType: "blocks",
      })
      .returning();

    const response = await request(`/${relation.id}`, "PATCH", {});
    expect(response.status).toBe(400);
  });
});
