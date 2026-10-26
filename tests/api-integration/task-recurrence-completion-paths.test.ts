import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import updateColumn from "../../apps/api/src/column/controllers/update-column";
import db, { schema } from "../../apps/api/src/database";
import { publishEvent } from "../../apps/api/src/events";
import "../../apps/api/src/task/recurrence/subscribe";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: recurrence completion events", () => {
  beforeEach(resetTestDatabase);

  it.each(["column-finality", "legacy-column-finality", "import-update"])(
    "continues the series after %s",
    async (completion) => {
      const member = await createWorkspaceMember();
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const recurrence = {
        frequency: "weekly",
        interval: 1,
        timeZone: "UTC",
      } as const;
      const [source] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          columnId:
            completion === "legacy-column-finality" ? null : columns.todo.id,
          status: columns.todo.slug,
          title: "Weekly report",
          dueDate: new Date("2026-03-10T00:00:00Z"),
          recurrence,
        })
        .returning();
      await db
        .update(schema.projectTable)
        .set({ lastTaskNumber: source.number ?? 1 })
        .where(eq(schema.projectTable.id, project.id));
      if (completion === "import-update") {
        await db
          .update(schema.taskTable)
          .set({ status: "done", columnId: columns.done.id })
          .where(eq(schema.taskTable.id, source.id));
        await publishEvent("task.updated", {
          taskId: source.id,
          projectId: project.id,
        });
      } else {
        await updateColumn(columns.todo.id, { isFinal: true });
      }
      await vi.waitFor(async () => {
        const tasks = await db.query.taskTable.findMany();
        expect(tasks).toHaveLength(2);
        expect(tasks.find((task) => task.id !== source.id)).toMatchObject({
          recurrence,
          status: completion === "import-update" ? "to-do" : "in-progress",
          dueDate: new Date("2026-03-17T00:00:00Z"),
        });
        expect(tasks.find((task) => task.id === source.id)).toMatchObject({
          recurrence: null,
        });
      });
    },
  );
});
