import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function context() {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
    slug: "TEST",
  });
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      ["Ancestor", "Parent", "Current", "Child", "Descendant", "Available"].map(
        (title, index) => ({
          title: `Candidate ${title}`,
          projectId: project.id,
          number: index + 1,
        }),
      ),
    )
    .returning();
  for (let index = 0; index < 4; index++) {
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: tasks[index].id,
      targetTaskId: tasks[index + 1].id,
      relationType: "subtask",
    });
  }
  mockAuthenticatedSession(member.user);
  return { ...member, project, tasks };
}

async function search(
  workspaceId: string,
  filter: Record<string, string>,
  q = "Candidate",
) {
  const response = await createApp().app.request(
    `/api/search?${new URLSearchParams({
      q,
      type: "tasks",
      workspaceId,
      ...filter,
    })}`,
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  return body.results.map((task: { id: string }) => task.id);
}

describe("subtask candidate search", () => {
  it("filters ancestors and already-parented children before the limit, including short IDs", async () => {
    const { workspace, tasks } = await context();
    expect(await search(workspace.id, { subtaskOf: tasks[2].id })).toEqual([
      tasks[5].id,
    ]);
    expect(
      await search(workspace.id, {
        subtaskOf: tasks[2].id,
        limit: "1",
      }),
    ).toEqual([tasks[5].id]);
    expect(
      await search(workspace.id, { subtaskOf: tasks[2].id }, "TEST-1"),
    ).toEqual([]);
    expect(
      await search(workspace.id, { subtaskOf: tasks[2].id }, "TEST-6"),
    ).toEqual([tasks[5].id]);
  });

  it("filters descendants for a new parent and offers none when the child already has a parent", async () => {
    const { workspace, tasks } = await context();
    expect(await search(workspace.id, { parentOf: tasks[0].id })).toEqual([
      tasks[5].id,
    ]);
    expect(await search(workspace.id, { parentOf: tasks[2].id })).toEqual([]);
    expect(await search(workspace.id, {})).toHaveLength(6);
  });

  it("allows a subtask to receive its own child", async () => {
    const { workspace, tasks } = await context();
    expect(await search(workspace.id, { subtaskOf: tasks[2].id })).toContain(
      tasks[5].id,
    );
    const response = await createApp().app.request("/api/task-relation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceTaskId: tasks[2].id,
        targetTaskId: tasks[5].id,
        relationType: "subtask",
      }),
    });
    expect(response.status).toBe(200);
    expect(await search(workspace.id, { subtaskOf: tasks[2].id })).toEqual([]);
  });

  it("keeps cross-project candidates scoped to accessible projects and anchors", async () => {
    const { workspace, user, project, tasks } = await context();
    const { project: otherProject } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [otherTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: otherProject.id,
        title: "Candidate Other project",
        number: 1,
      })
      .returning();
    expect(await search(workspace.id, { subtaskOf: tasks[2].id })).toContain(
      otherTask.id,
    );
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: workspace.id,
      userId: user.id,
      projectAccess: "selected",
    });
    await db.insert(schema.workspaceMemberProjectTable).values({
      workspaceId: workspace.id,
      userId: user.id,
      projectId: project.id,
    });
    expect(await search(workspace.id, { subtaskOf: tasks[2].id })).toEqual([
      tasks[5].id,
    ]);
    expect(await search(workspace.id, { subtaskOf: otherTask.id })).toEqual([]);
  });

  it("does not use a task from another workspace as a hierarchy anchor", async () => {
    const { workspace } = await context();
    const other = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Other workspace",
        number: 1,
      })
      .returning();
    expect(await search(workspace.id, { subtaskOf: task.id })).toEqual([]);
  });

  it("rejects ambiguous filters and filters on non-task searches", async () => {
    const { workspace, tasks } = await context();
    for (const filter of [
      { subtaskOf: tasks[0].id, parentOf: tasks[0].id, type: "tasks" },
      { subtaskOf: tasks[0].id, type: "all" },
    ]) {
      const response = await createApp().app.request(
        `/api/search?${new URLSearchParams({ q: "Candidate", workspaceId: workspace.id, ...filter })}`,
      );
      expect(response.status).toBe(400);
    }
  });
});
