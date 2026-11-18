import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { getSprintList } from "./get-sprints";

// Only future sprints may change position: the active sprint is running and
// closed sprints keep their order in the history.
async function reorderSprints(
  projectId: string,
  sprints: Array<{ id: string; position: number }>,
) {
  await db.transaction(async (tx) => {
    for (const sprint of sprints) {
      const [updated] = await tx
        .update(sprintTable)
        .set({ position: sprint.position })
        .where(
          and(
            eq(sprintTable.id, sprint.id),
            eq(sprintTable.projectId, projectId),
            eq(sprintTable.status, "future"),
          ),
        )
        .returning({ id: sprintTable.id });

      if (!updated) {
        throw new HTTPException(400, {
          message: `Sprint ${sprint.id} does not exist in this project, or is not a future sprint`,
        });
      }
    }
  });

  await publishEvent("sprint.updated", { projectId });

  return getSprintList(projectId);
}

export default reorderSprints;
