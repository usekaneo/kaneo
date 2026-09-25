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

function request(path: string) {
  return createApp().app.request(`/api/task-relation${path}`, {
    method: "GET",
  });
}

// Powers the Gantt chart's dependency lines: GET /task-relation/project/{id}
// returns every relation touching one of the project's own tasks, including
// ones whose other end sits in a different project (as long as that other
// project is in the same workspace) — the case that has no coverage yet.
describe("GET /task-relation/project/{projectId}", () => {
  it("returns relations that touch the project's own tasks, resolving a cross-project far end with its dates and project name", async () => {
    const member = await createWorkspaceMember();
    const { project: projectA } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Project A",
    });
    const { project: projectB } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Project B",
    });

    const [ownTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: projectA.id,
        title: "Own task",
        number: 1,
        startDate: new Date("2024-01-01T00:00:00.000Z"),
        dueDate: new Date("2024-01-05T00:00:00.000Z"),
      })
      .returning();
    const [otherOwnTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: projectA.id,
        title: "Unrelated own task",
        number: 2,
      })
      .returning();
    const [crossProjectTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: projectB.id,
        title: "Cross-project task",
        number: 1,
        startDate: new Date("2024-02-01T00:00:00.000Z"),
        dueDate: new Date("2024-02-10T00:00:00.000Z"),
      })
      .returning();

    // Same-workspace, cross-project relation touching projectA's own task.
    const [crossProjectRelation] = await db
      .insert(schema.taskRelationTable)
      .values({
        sourceTaskId: ownTask.id,
        targetTaskId: crossProjectTask.id,
        relationType: "blocks",
      })
      .returning();

    // Noise: a relation entirely inside another workspace must never leak
    // into projectA's results.
    const foreignMember = await createWorkspaceMember();
    const { project: foreignProject } = await createProjectFixture({
      workspaceId: foreignMember.workspace.id,
    });
    const [foreignTaskOne] = await db
      .insert(schema.taskTable)
      .values({ projectId: foreignProject.id, title: "Foreign one", number: 1 })
      .returning();
    const [foreignTaskTwo] = await db
      .insert(schema.taskTable)
      .values({ projectId: foreignProject.id, title: "Foreign two", number: 2 })
      .returning();
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: foreignTaskOne.id,
      targetTaskId: foreignTaskTwo.id,
      relationType: "related",
    });

    mockAuthenticatedSession(member.user);
    const response = await request(`/project/${projectA.id}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{
      id: string;
      sourceTaskId: string;
      targetTaskId: string;
      relationType: string;
      sourceTask: { id: string } | null;
      targetTask: {
        id: string;
        projectId: string;
        projectName: string;
        projectSlug: string;
        startDate: string | null;
        dueDate: string | null;
      } | null;
    }>;

    // otherOwnTask never appears in any relation, so it contributes no row;
    // exactly the cross-project relation is returned, and no foreign row.
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: crossProjectRelation.id,
      sourceTaskId: ownTask.id,
      targetTaskId: crossProjectTask.id,
      relationType: "blocks",
      sourceTask: { id: ownTask.id },
    });
    expect(body[0].targetTask).toMatchObject({
      id: crossProjectTask.id,
      projectId: projectB.id,
      projectName: "Project B",
      projectSlug: projectB.slug,
      startDate: "2024-02-01T00:00:00.000Z",
      dueDate: "2024-02-10T00:00:00.000Z",
    });
    // otherOwnTask is unused other than proving it doesn't appear above.
    expect(otherOwnTask).toBeDefined();
  });

  it("enforces workspace access: a user with no membership in the project's workspace is refused", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const outsider = await createWorkspaceMember();

    mockAuthenticatedSession(outsider.user);
    const response = await request(`/project/${project.id}`);
    expect(response.status).toBe(403);
  });

  it("returns 400 for a project id that does not resolve to a workspace", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const response = await request("/project/missing-project");
    expect(response.status).toBe(400);
  });
});
