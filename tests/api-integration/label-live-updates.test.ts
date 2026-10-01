import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import updateLabel from "../../apps/api/src/label/controllers/update-label";
import { resetTestDatabase } from "./helpers/database";
import {
  createWorkspaceMember,
  createProjectFixture,
} from "./helpers/fixtures";
const publish = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../../apps/api/src/events", () => ({ publishEvent: publish }));
beforeEach(async () => {
  await resetTestDatabase();
  publish.mockReset();
});
async function task(projectId: string, number: number) {
  const [row] = await db
    .insert(schema.taskTable)
    .values({ projectId, number, title: `Task ${number}`, status: "to-do" })
    .returning();
  return row;
}
it("announces committed workspace label edits once per affected board", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project: first } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const { project: second } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const { workspace: otherWorkspace } = await createWorkspaceMember();
  const { project: foreign } = await createProjectFixture({
    workspaceId: otherWorkspace.id,
  });
  const [a, b, c, privateTask] = await Promise.all([
    task(first.id, 1),
    task(first.id, 2),
    task(second.id, 1),
    task(foreign.id, 1),
  ]);
  const [root] = await db
    .insert(schema.labelTable)
    .values({ workspaceId: workspace.id, name: "Old", color: "#000000" })
    .returning();
  await db.insert(schema.labelTable).values(
    [a, b, c].map((row) => ({
      taskId: row.id,
      workspaceId: workspace.id,
      name: "Old",
      color: "#000000",
    })),
  );
  await db.insert(schema.labelTable).values({
    taskId: privateTask.id,
    workspaceId: otherWorkspace.id,
    name: "Old",
    color: "#000000",
  });
  await updateLabel(root.id, "Renamed", "#123456");
  expect(publish.mock.calls.map((call) => call)).toEqual(
    expect.arrayContaining([
      ["project.updated", { projectId: first.id }],
      ["project.updated", { projectId: second.id }],
    ]),
  );
  expect(publish).toHaveBeenCalledTimes(2);
  const labels = await db.query.labelTable.findMany();
  expect(
    labels
      .filter((label) => label.workspaceId === workspace.id)
      .every((label) => label.name === "Renamed" && label.color === "#123456"),
  ).toBe(true);
  expect(labels.find((label) => label.taskId === privateTask.id)?.name).toBe(
    "Old",
  );
});
it("announces a direct task label recolor and emits nothing for a failed edit", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const row = await task(project.id, 1);
  const [label] = await db
    .insert(schema.labelTable)
    .values({
      taskId: row.id,
      workspaceId: workspace.id,
      name: "Bug",
      color: "#000000",
    })
    .returning();
  await updateLabel(label.id, "Bug", "#123456");
  expect(publish.mock.calls).toEqual([
    ["project.updated", { projectId: project.id }],
  ]);
  publish.mockClear();
  await expect(updateLabel("missing", "Name", "#000000")).rejects.toThrow(
    "Label not found",
  );
  expect(publish).not.toHaveBeenCalled();
});

it("announces an unassigned workspace label edit to every local board's choices", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project: first } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const { project: second } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const { workspace: foreign } = await createWorkspaceMember();
  await createProjectFixture({ workspaceId: foreign.id });
  const [label] = await db
    .insert(schema.labelTable)
    .values({ workspaceId: workspace.id, name: "Unassigned", color: "red" })
    .returning();
  publish.mockImplementation(async () => {
    expect(
      await db.query.labelTable.findFirst({
        where: eq(schema.labelTable.id, label.id),
      }),
    ).toMatchObject({ name: "Renamed", color: "blue" });
  });
  await updateLabel(label.id, "Renamed", "blue");
  expect(publish.mock.calls).toEqual(
    expect.arrayContaining([
      ["project.updated", { projectId: first.id }],
      ["project.updated", { projectId: second.id }],
    ]),
  );
  expect(publish).toHaveBeenCalledTimes(2);
});
