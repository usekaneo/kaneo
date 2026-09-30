import { beforeEach, expect, it, vi } from "vite-plus/test";
import db from "../../apps/api/src/database";
import createColumn from "../../apps/api/src/column/controllers/create-column";
import updateColumn from "../../apps/api/src/column/controllers/update-column";
import deleteColumn from "../../apps/api/src/column/controllers/delete-column";
import reorderColumns from "../../apps/api/src/column/controllers/reorder-columns";
import { resetTestDatabase } from "./helpers/database";
import {
  createWorkspaceMember,
  createProjectFixture,
} from "./helpers/fixtures";
const publish = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../../apps/api/src/events", () => ({ publishEvent: publish }));
beforeEach(async () => {
  await resetTestDatabase();
  publish.mockClear();
});
it("announces committed column changes for focused remote boards", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const column = await createColumn({ projectId: project.id, name: "Review" });
  await updateColumn(column.id, { name: "Reviewed", color: "#123456" });
  await reorderColumns(project.id, [{ id: column.id, position: 0 }]);
  await deleteColumn(column.id);
  expect(publish.mock.calls).toEqual(
    Array.from({ length: 4 }, () => [
      "project.updated",
      { projectId: project.id },
    ]),
  );
  expect(
    await db.query.columnTable.findFirst({
      where: (table, { eq }) => eq(table.id, column.id),
    }),
  ).toBeUndefined();
  await expect(deleteColumn(column.id)).rejects.toThrow("Column not found");
  expect(publish).toHaveBeenCalledTimes(4);
});
