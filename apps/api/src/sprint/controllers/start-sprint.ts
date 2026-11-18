import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, sprintTable } from "../../database/schema";
import { isDatabaseUniqueViolation } from "../../integrations/map-unique-violation";
import { publishEvent } from "../../events";
import { getSprint } from "./get-sprints";
import {
  DEFAULT_SPRINT_LENGTH_DAYS,
  deriveSprintEndDate,
} from "../sprint-defaults";
import {
  validateAndParseDate,
  validateDateRange,
} from "../../utils/validate-dates";

// Starting a sprint is what Jira calls "start sprint": the future sprint
// becomes the single active sprint of its project and gets concrete dates.
async function startSprint(
  id: string,
  data: {
    startDate?: string;
    endDate?: string;
  },
) {
  const existing = await db.query.sprintTable.findFirst({
    where: eq(sprintTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Sprint not found" });
  }

  if (existing.status !== "future") {
    throw new HTTPException(409, {
      message:
        existing.status === "active"
          ? "Sprint is already active"
          : "Closed sprints cannot be restarted",
    });
  }

  const [activeSprint] = await db
    .select({ id: sprintTable.id, name: sprintTable.name })
    .from(sprintTable)
    .where(
      and(
        eq(sprintTable.projectId, existing.projectId),
        eq(sprintTable.status, "active"),
      ),
    )
    .limit(1);

  if (activeSprint) {
    throw new HTTPException(409, {
      message: `Sprint "${activeSprint.name}" is already active. Close it before starting another sprint.`,
    });
  }

  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, existing.projectId),
  });

  const start = data.startDate
    ? validateAndParseDate(data.startDate, "Start date")
    : (existing.startDate ?? new Date());
  const end = data.endDate
    ? validateAndParseDate(data.endDate, "End date")
    : (existing.endDate ??
      deriveSprintEndDate(
        start,
        project?.defaultSprintLengthDays ?? DEFAULT_SPRINT_LENGTH_DAYS,
      ));
  validateDateRange(start, end);

  let updated: typeof sprintTable.$inferSelect | undefined;
  try {
    [updated] = await db
      .update(sprintTable)
      .set({ status: "active", startDate: start, endDate: end })
      // The claim only fires while the sprint is still future: a sprint
      // that closed (or otherwise changed) between the read check and this
      // write fails the condition instead of being resurrected.
      .where(and(eq(sprintTable.id, id), eq(sprintTable.status, "future")))
      .returning();
  } catch (error) {
    // Two concurrent starts can both pass the read check above; the partial
    // unique index keeps one active sprint per project and maps back to 409.
    if (
      isDatabaseUniqueViolation(error) &&
      error.constraint === "sprint_project_active_unique"
    ) {
      throw new HTTPException(409, {
        message:
          "Another sprint is already active. Close it before starting another sprint.",
      });
    }
    throw error;
  }

  if (!updated) {
    throw new HTTPException(409, {
      message:
        "The sprint is no longer upcoming and cannot be started. Reload the sprint list and try again.",
    });
  }

  await publishEvent("sprint.updated", {
    projectId: updated.projectId,
    sprintId: updated.id,
  });

  return getSprint(updated.projectId, updated.id);
}

export default startSprint;
