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
      expect(await response.text()).toBe("Target task not found");
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
    expect(await response.text()).toBe("Task relation not found");
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
    expect((await request(`/${relation.id}`, "DELETE")).status).toBe(403);
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

describe("GET /task-relation/project/:projectId", () => {
  it("returns every relation touching the project's tasks, in either direction", async () => {
    const own = await context();
    const { project: otherProject } = await createProjectFixture({
      workspaceId: own.workspace.id,
    });
    const [siblingTask] = await db
      .insert(schema.taskTable)
      .values({ projectId: own.task.projectId, title: "Sibling", number: 2 })
      .returning();
    const [outsideTask] = await db
      .insert(schema.taskTable)
      .values({ projectId: otherProject.id, title: "Outside", number: 1 })
      .returning();

    // own.task -> siblingTask (both in the project) and own.task -> outsideTask
    // (source in the project, target outside it) should both come back;
    // relations with neither end in the project must not.
    const inProject = await seedRelation(own.task.id, siblingTask.id);
    const crossProject = await seedRelation(own.task.id, outsideTask.id);
    const outsideOnly = await db
      .insert(schema.taskRelationTable)
      .values({
        sourceTaskId: outsideTask.id,
        targetTaskId: outsideTask.id,
        relationType: "related",
      })
      .returning();

    mockAuthenticatedSession(own.user);
    const response = await request(`/project/${own.task.projectId}`, "GET");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string }[];
    const ids = body.map((relation) => relation.id);
    expect(ids).toContain(inProject.id);
    expect(ids).toContain(crossProject.id);
    expect(ids).not.toContain(outsideOnly[0]?.id);
  });

  // Powers the Gantt chart's cross-project rows (see PRIORITY 3): the far
  // end of a cross-project relation needs its own dates and its project's
  // name/slug to be placed on the timeline and labeled, in addition to the
  // fields the single-task endpoint already returned.
  it("includes the related task's dates and project name/slug, for both same- and cross-project relations", async () => {
    const own = await context();
    const { project: otherProject } = await createProjectFixture({
      workspaceId: own.workspace.id,
      name: "Other Project",
      slug: "other-project",
    });
    const [siblingTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: own.task.projectId,
        title: "Sibling",
        number: 2,
        startDate: new Date("2026-08-20T00:00:00.000Z"),
        dueDate: new Date("2026-08-25T00:00:00.000Z"),
      })
      .returning();
    const [outsideTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: otherProject.id,
        title: "Outside",
        number: 1,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        dueDate: new Date("2026-09-05T00:00:00.000Z"),
      })
      .returning();

    const inProject = await seedRelation(own.task.id, siblingTask.id);
    const crossProject = await seedRelation(own.task.id, outsideTask.id);

    mockAuthenticatedSession(own.user);
    const response = await request(`/project/${own.task.projectId}`, "GET");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      id: string;
      targetTask: {
        startDate: string | null;
        dueDate: string | null;
        projectName: string;
        projectSlug: string;
      } | null;
    }[];

    const sameProjectRelation = body.find(
      (relation) => relation.id === inProject.id,
    );
    expect(sameProjectRelation?.targetTask).toMatchObject({
      startDate: "2026-08-20T00:00:00.000Z",
      dueDate: "2026-08-25T00:00:00.000Z",
      projectName: "Integration Project",
    });
    expect(sameProjectRelation?.targetTask?.projectSlug).toEqual(
      expect.any(String),
    );

    const crossProjectRelation = body.find(
      (relation) => relation.id === crossProject.id,
    );
    expect(crossProjectRelation?.targetTask).toMatchObject({
      startDate: "2026-09-01T00:00:00.000Z",
      dueDate: "2026-09-05T00:00:00.000Z",
      projectName: "Other Project",
      projectSlug: "other-project",
    });
  });

  it("rejects a caller without access to the project's workspace", async () => {
    const own = await context();
    const foreign = await context();
    mockAuthenticatedSession(foreign.user);
    const response = await request(`/project/${own.task.projectId}`, "GET");
    expect(response.status).toBe(403);
  });

  it("returns an empty list for a project with no tasks", async () => {
    const own = await context();
    const { project: emptyProject } = await createProjectFixture({
      workspaceId: own.workspace.id,
    });
    mockAuthenticatedSession(own.user);
    const response = await request(`/project/${emptyProject.id}`, "GET");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
