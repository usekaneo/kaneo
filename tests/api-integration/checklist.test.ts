import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

type User = Parameters<typeof requestAs>[0];

async function setup() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const viewer = await addWorkspaceMember(workspace.id, "viewer", "Vera");
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  let number = 0;
  const task = async (title: string) => {
    number += 1;
    const [row] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title,
        status: "to-do",
        columnId: columns.todo.id,
        priority: "medium",
        number,
        position: number,
      })
      .returning();
    if (!row) throw new Error("no task");
    return row.id;
  };
  return { owner, viewer, task };
}

const subtask = (
  user: User,
  parent: string,
  child: string,
  checklistId?: string,
) =>
  requestAs(user)("/task-relation", {
    method: "POST",
    body: {
      sourceTaskId: parent,
      targetTaskId: child,
      relationType: "subtask",
      checklistId,
    },
  });

async function itemsOf(user: User, parent: string) {
  const relations = (await requestAs(user)(`/task-relation/${parent}`)).json;
  return relations
    .filter(
      (r: { relationType: string; sourceTaskId: string }) =>
        r.relationType === "subtask" && r.sourceTaskId === parent,
    )
    .map((r: { checklistId: string; targetTask: { title: string } }) => ({
      checklist: r.checklistId,
      title: r.targetTask.title,
    }));
}

describe("task checklists", () => {
  it("puts existing subtasks into a default checklist, in order", async () => {
    const { owner, task } = await setup();
    const parent = await task("Parent");
    // Subtasks from before checklists existed have no checklist.
    for (const title of ["One", "Two"]) {
      await db.insert(schema.taskRelationTable).values({
        sourceTaskId: parent,
        targetTaskId: await task(title),
        relationType: "subtask",
      });
    }

    const lists = await requestAs(owner)(`/checklist/${parent}`);
    expect(lists.json).toHaveLength(1);
    expect(lists.json[0].title).toBeNull();
    expect(await itemsOf(owner, parent)).toEqual([
      { checklist: lists.json[0].id, title: "One" },
      { checklist: lists.json[0].id, title: "Two" },
    ]);

    // Reading again doesn't create another one.
    expect((await requestAs(owner)(`/checklist/${parent}`)).json).toHaveLength(
      1,
    );
  });

  it("adds, renames, reorders and moves items between checklists", async () => {
    const { owner, task } = await setup();
    const parent = await task("Parent");
    const design = await requestAs(owner)("/checklist", {
      method: "POST",
      body: { taskId: parent, title: "Design" },
    });
    const qa = await requestAs(owner)("/checklist", {
      method: "POST",
      body: { taskId: parent, title: "QA" },
    });
    await subtask(owner, parent, await task("Wireframe"), design.json.id);
    await subtask(owner, parent, await task("Colors"), design.json.id);
    await subtask(owner, parent, await task("iOS test"), qa.json.id);

    const relations = (await requestAs(owner)(`/task-relation/${parent}`)).json;
    const idOf = (title: string) =>
      relations.find(
        (r: { targetTask: { title: string } }) => r.targetTask.title === title,
      ).id;

    // Drag "Colors" to the top of QA.
    const moved = await requestAs(owner)(`/checklist/${qa.json.id}/items`, {
      method: "PUT",
      body: {
        taskId: parent,
        relationIds: [idOf("Colors"), idOf("iOS test")],
      },
    });
    expect(moved.status).toBe(200);
    const qaItems = (await itemsOf(owner, parent)).filter(
      (i: { checklist: string }) => i.checklist === qa.json.id,
    );
    expect(qaItems.map((i: { title: string }) => i.title)).toEqual([
      "Colors",
      "iOS test",
    ]);

    await requestAs(owner)(`/checklist/${design.json.id}`, {
      method: "PATCH",
      body: { taskId: parent, title: "UI" },
    });
    const reordered = await requestAs(owner)("/checklist/order", {
      method: "PUT",
      body: { taskId: parent, checklistIds: [qa.json.id, design.json.id] },
    });
    expect(reordered.json.map((c: { title: string }) => c.title)).toEqual([
      "QA",
      "UI",
    ]);
  });

  it("deletes a checklist with its items, and keeps other tasks' items out", async () => {
    const { owner, viewer, task } = await setup();
    const parent = await task("Parent");
    const other = await task("Other parent");
    const list = await requestAs(owner)("/checklist", {
      method: "POST",
      body: { taskId: parent },
    });
    const child = await task("Child");
    await subtask(owner, parent, child, list.json.id);
    const foreign = await task("Foreign");
    await subtask(owner, other, foreign);
    const [foreignRelation] = await db
      .select()
      .from(schema.taskRelationTable)
      .where(eq(schema.taskRelationTable.targetTaskId, foreign));

    const stolen = await requestAs(owner)(`/checklist/${list.json.id}/items`, {
      method: "PUT",
      body: { taskId: parent, relationIds: [foreignRelation?.id] },
    });
    expect(stolen.status).toBe(400);

    const denied = await requestAs(viewer)(`/checklist/${list.json.id}`, {
      method: "DELETE",
      body: { taskId: parent },
    });
    expect(denied.status).toBe(403);

    const removed = await requestAs(owner)(`/checklist/${list.json.id}`, {
      method: "DELETE",
      body: { taskId: parent },
    });
    expect(removed.json).toEqual({ id: list.json.id, deletedItems: 1 });
    const left = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, child));
    expect(left).toHaveLength(0);
  });
});
