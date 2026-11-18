import { and, eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable } from "../../database/schema";
import { isDatabaseUniqueViolation } from "../../integrations/map-unique-violation";
import { publishEvent } from "../../events";
import { getSprint } from "./get-sprints";
import {
  validateAndParseDate,
  validateDateRange,
} from "../../utils/validate-dates";

// Closed sprints are immutable history. The active sprint may only be renamed,
// re-goal'ed or re-dated at its end; its start cannot move because it is
// already running.
async function updateSprint(
  id: string,
  data: {
    name?: string;
    goal?: string | null;
    startDate?: string;
    endDate?: string | null;
  },
) {
  const existing = await db.query.sprintTable.findFirst({
    where: eq(sprintTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Sprint not found" });
  }

  if (existing.status === "closed") {
    throw new HTTPException(409, {
      message:
        "Closed sprints are immutable. Their tasks stay as the history of what was implemented.",
    });
  }

  const start =
    data.startDate !== undefined
      ? validateAndParseDate(data.startDate, "Start date")
      : existing.startDate;
  const end =
    data.endDate !== undefined
      ? data.endDate === null
        ? null
        : validateAndParseDate(data.endDate, "End date")
      : existing.endDate;
  validateDateRange(start, end);

  if (data.startDate !== undefined && existing.status !== "future") {
    throw new HTTPException(400, {
      message:
        "Only future sprints can change their start date; the active sprint is already running",
    });
  }

  if (data.name !== undefined && data.name !== existing.name) {
    const [nameClash] = await db
      .select({ id: sprintTable.id })
      .from(sprintTable)
      .where(
        and(
          eq(sprintTable.projectId, existing.projectId),
          eq(sprintTable.name, data.name),
          ne(sprintTable.id, id),
        ),
      )
      .limit(1);

    if (nameClash) {
      throw new HTTPException(409, {
        message: `Sprint "${data.name}" already exists in this project`,
      });
    }
  }

  let updated: typeof sprintTable.$inferSelect | undefined;
  try {
    [updated] = await db
      .update(sprintTable)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.goal !== undefined && { goal: data.goal }),
        ...(data.startDate !== undefined && { startDate: start }),
        ...(data.endDate !== undefined && { endDate: end }),
      })
      .where(eq(sprintTable.id, id))
      .returning();
  } catch (error) {
    // The clash check above races a concurrent rename; the unique constraint
    // is the final authority and must surface as a 409, not a 500.
    if (
      isDatabaseUniqueViolation(error) &&
      error.constraint === "sprint_project_name_unique"
    ) {
      throw new HTTPException(409, {
        message: `Sprint "${data.name}" already exists in this project`,
      });
    }
    throw error;
  }

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update sprint" });
  }

  await publishEvent("sprint.updated", {
    projectId: updated.projectId,
    sprintId: updated.id,
  });

  return getSprint(updated.projectId, updated.id);
}

export default updateSprint;
