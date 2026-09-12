import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type RelationRow = typeof schema.taskRelationTable.$inferSelect;

let taskCounter = 0;

async function seedTask(
  userId: string,
  projectId: string,
  title: string,
  status = "to-do",
) {
  taskCounter += 1;
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      userId,
      title,
      status,
      priority: "medium",
      number: taskCounter,
      position: taskCounter,
    })
    .returning();
  return task;
}

async function relate(
  sourceTaskId: string,
  targetTaskId: string,
  relationType = "subtask",
) {
  const [relation] = await db
    .insert(schema.taskRelationTable)
    .values({ sourceTaskId, targetTaskId, relationType })
    .returning();
  return relation;
}

async function fetchProjectRelations(projectId: string) {
  const { app } = createApp();
  return app.request(`/api/task-relation/project/${projectId}`);
}

describe("API integration: project task relations", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    taskCounter = 0;
  });

  it("returns the relations joining two tasks in the project", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const parent = await seedTask(member.user.id, project.id, "Parent");
    const child = await seedTask(member.user.id, project.id, "Child");
    const blocker = await seedTask(member.user.id, project.id, "Blocker");

    const subtask = await relate(parent.id, child.id, "subtask");
    const blocks = await relate(blocker.id, parent.id, "blocks");

    const response = await fetchProjectRelations(project.id);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as RelationRow[];

    // Every type is returned; narrowing to subtasks is the caller's business.
    expect(payload.map((relation) => relation.id).sort()).toEqual(
      [subtask.id, blocks.id].sort(),
    );
    expect(
      payload.find((relation) => relation.id === subtask.id),
    ).toMatchObject({
      sourceTaskId: parent.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });
  });

  it("omits a relation whose other end is in a different project", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const other = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "other-project",
    });

    const parent = await seedTask(member.user.id, project.id, "Parent");
    const inside = await seedTask(member.user.id, project.id, "Inside");
    const outside = await seedTask(member.user.id, other.project.id, "Outside");

    const kept = await relate(parent.id, inside.id);
    await relate(parent.id, outside.id);

    const response = await fetchProjectRelations(project.id);
    const payload = (await response.json()) as RelationRow[];

    expect(payload.map((relation) => relation.id)).toEqual([kept.id]);
  });

  it("returns an empty list for a project with no relations", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const response = await fetchProjectRelations(project.id);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("refuses a member whose role does not grant task:read", async () => {
    const member = await createWorkspaceMember({ role: "viewer" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await seedTask(member.user.id, project.id, "Parent");

    // A workspace can redefine its roles, and the stored definition wins over
    // the compiled-in one. This is the shape an API key restricted below
    // task:read also takes.
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: member.workspace.id,
      role: "viewer",
      permission: JSON.stringify({ project: ["read"], workspace: ["read"] }),
    });

    mockAuthenticatedSession(member.user);
    const response = await fetchProjectRelations(project.id);

    expect(response.status).toBe(403);
  });

  it("allows a viewer, whose built-in role grants task:read", async () => {
    const member = await createWorkspaceMember({ role: "viewer" });
    mockAuthenticatedSession(member.user);
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const parent = await seedTask(member.user.id, project.id, "Parent");
    const child = await seedTask(member.user.id, project.id, "Child");
    const relation = await relate(parent.id, child.id);

    const response = await fetchProjectRelations(project.id);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as RelationRow[];
    expect(payload.map((row) => row.id)).toEqual([relation.id]);
  });

  it("refuses a caller outside the project's workspace", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    await seedTask(owner.user.id, project.id, "Parent");

    const outsider = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(outsider.user);

    const response = await fetchProjectRelations(project.id);

    expect(response.status).toBe(403);
  });
});
