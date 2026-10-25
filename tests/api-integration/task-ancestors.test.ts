import { eventContext, publishEvent } from "../../apps/api/src/events";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { boundedTaskRead } from "../../apps/api/src/task/bounded-read";
import { getTaskAncestors } from "../../apps/api/src/task/get-task-ancestors";
import { getTaskDescendantProjects } from "../../apps/api/src/task/get-task-descendant-projects";
import getTasks from "../../apps/api/src/task/controllers/get-tasks";
import getTask from "../../apps/api/src/task/controllers/get-task";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
beforeEach(resetTestDatabase);
async function fixture() {
  const { workspace, user } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [parent, child, grandchild] = await db
    .insert(schema.taskTable)
    .values([
      { projectId: project.id, title: "Parent", status: "done", number: 1 },
      {
        projectId: project.id,
        title: "Child",
        status: "in-progress",
        number: 2,
      },
      {
        projectId: project.id,
        title: "Grandchild",
        status: "to-do",
        number: 3,
      },
    ])
    .returning();
  await db.insert(schema.taskRelationTable).values([
    {
      sourceTaskId: parent.id,
      targetTaskId: child.id,
      relationType: "subtask",
    },
    {
      sourceTaskId: child.id,
      targetTaskId: grandchild.id,
      relationType: "subtask",
    },
  ]);
  return { workspace, user, project, parent, child, grandchild };
}
it("includes off-page and filtered ancestors in nearest-parent-first order", async () => {
  const f = await fixture();
  const board = await getTasks(
    f.project.id,
    { status: "to-do", limit: 1 },
    f.user.id,
  );
  const card = board.data.columns.flatMap((column) => column.tasks)[0];
  expect(card.id).toBe(f.grandchild.id);
  expect(card.ancestors?.map((task) => task.title)).toEqual([
    "Child",
    "Parent",
  ]);
  expect((await getTask(f.grandchild.id, true, f.user.id)).ancestors).toEqual(
    card.ancestors,
  );
});
it("loads accessible cross-project ancestors and stops at an inaccessible parent", async () => {
  const f = await fixture();
  const other = await createProjectFixture({ workspaceId: f.workspace.id });
  await db
    .update(schema.taskTable)
    .set({ projectId: other.project.id })
    .where(eq(schema.taskTable.id, f.child.id));
  const read = () =>
    boundedTaskRead((tx) =>
      getTaskAncestors(tx, [f.grandchild.id], f.workspace.id, f.user.id),
    );
  expect(
    (await read()).get(f.grandchild.id)?.map((task) => task.title),
  ).toEqual(["Child", "Parent"]);
  await db.insert(schema.workspaceMemberAccessTable).values({
    userId: f.user.id,
    workspaceId: f.workspace.id,
    projectAccess: "selected",
  });
  await db.insert(schema.workspaceMemberProjectTable).values({
    userId: f.user.id,
    workspaceId: f.workspace.id,
    projectId: f.project.id,
  });
  expect((await read()).get(f.grandchild.id)).toBeUndefined();
});
it("never follows legacy cross-workspace edges or exposes ancestry on public boards", async () => {
  const f = await fixture();
  const outside = await createWorkspaceMember();
  const other = await createProjectFixture({
    workspaceId: outside.workspace.id,
  });
  await db
    .update(schema.taskTable)
    .set({ projectId: other.project.id })
    .where(eq(schema.taskTable.id, f.child.id));
  const ancestors = await boundedTaskRead((tx) =>
    getTaskAncestors(tx, [f.grandchild.id], f.workspace.id, f.user.id),
  );
  expect(ancestors.size).toBe(0);
  const board = await getTasks(f.project.id, { publicOnly: true });
  for (const task of board.data.columns.flatMap((column) => column.tasks))
    expect(task).not.toHaveProperty("ancestors");
});
it("terminates legacy cycles without repeating the card itself", async () => {
  const f = await fixture();
  await db.insert(schema.taskRelationTable).values({
    sourceTaskId: f.grandchild.id,
    targetTaskId: f.parent.id,
    relationType: "subtask",
  });
  const ancestors = await boundedTaskRead((tx) =>
    getTaskAncestors(tx, [f.grandchild.id], f.workspace.id, f.user.id),
  );
  expect(ancestors.get(f.grandchild.id)?.map((task) => task.id)).toEqual([
    f.child.id,
    f.parent.id,
  ]);
});
it("reflects renamed and removed ancestors on board refresh", async () => {
  const f = await fixture();
  await db
    .update(schema.taskTable)
    .set({ title: "Renamed parent" })
    .where(eq(schema.taskTable.id, f.parent.id));
  const read = () =>
    boundedTaskRead((tx) =>
      getTaskAncestors(tx, [f.grandchild.id], f.workspace.id, f.user.id),
    );
  expect((await read()).get(f.grandchild.id)?.[1].title).toBe("Renamed parent");
  await db
    .delete(schema.taskRelationTable)
    .where(eq(schema.taskRelationTable.sourceTaskId, f.parent.id));
  expect((await read()).get(f.grandchild.id)?.map((task) => task.id)).toEqual([
    f.child.id,
  ]);
});
it("finds descendant boards for ancestry invalidation, including other projects", async () => {
  const f = await fixture();
  const other = await createProjectFixture({ workspaceId: f.workspace.id });
  await db
    .update(schema.taskTable)
    .set({ projectId: other.project.id })
    .where(eq(schema.taskTable.id, f.grandchild.id));
  expect(await getTaskDescendantProjects([f.parent.id])).toEqual(
    expect.arrayContaining([
      { projectId: f.project.id },
      { projectId: other.project.id },
    ]),
  );
  expect(await getTaskDescendantProjects([f.grandchild.id])).toEqual([]);
});

it("refreshes descendant boards for ancestor titles and removed relationships, including the initiating window", async () => {
  const f = await fixture();
  const other = await createProjectFixture({ workspaceId: f.workspace.id });
  await db
    .update(schema.taskTable)
    .set({ projectId: other.project.id })
    .where(eq(schema.taskTable.id, f.grandchild.id));
  await initializeWebSocketAdapter();
  const send = vi.fn();
  const connection = addConnection(
    other.project.id,
    { send } as never,
    f.user.id,
    "same-window",
    f.workspace.id,
  );
  try {
    for (const event of ["task.title_changed", "task-relation.deleted"]) {
      send.mockClear();
      if (event === "task-relation.deleted")
        await db
          .delete(schema.taskRelationTable)
          .where(eq(schema.taskRelationTable.sourceTaskId, f.parent.id));
      await eventContext.run({ initiatorId: "same-window" }, () =>
        publishEvent(
          event,
          {
            taskId: f.parent.id,
            projectId: f.project.id,
            sourceTaskId: f.parent.id,
            targetTaskId: f.child.id,
          },
          { waitForHandlers: true },
        ),
      );
      await vi.waitFor(() => expect(send).toHaveBeenCalled());
      expect(send.mock.calls.map((call) => JSON.parse(call[0]))).toContainEqual(
        {
          type: "TASK_RELATION_UPDATED",
          projectId: other.project.id,
          taskId: "",
        },
      );
    }
  } finally {
    removeConnection(other.project.id, connection);
    await shutdownWebSocketAdapter();
  }
});
