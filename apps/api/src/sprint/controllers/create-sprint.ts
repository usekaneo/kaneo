import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable } from "../../database/schema";
import { isDatabaseUniqueViolation } from "../../integrations/map-unique-violation";
import { publishEvent } from "../../events";
import { getSprint } from "./get-sprints";
import { nextSprintName } from "../sprint-defaults";
import {
  validateAndParseDate,
  validateDateRange,
} from "../../utils/validate-dates";

async function createSprint({
  projectId,
  name,
  goal,
  startDate,
  endDate,
}: {
  projectId: string;
  name?: string;
  goal?: string | null;
  startDate?: string;
  endDate?: string;
}) {
  const start =
    startDate !== undefined
      ? validateAndParseDate(startDate, "Start date")
      : null;
  const end =
    endDate !== undefined ? validateAndParseDate(endDate, "End date") : null;
  validateDateRange(start, end);

  const projectSprints = await db
    .select({ id: sprintTable.id, name: sprintTable.name })
    .from(sprintTable)
    .where(eq(sprintTable.projectId, projectId));

  const sprintName = name ?? nextSprintName(projectSprints.map((s) => s.name));

  if (projectSprints.some((s) => s.name === sprintName)) {
    throw new HTTPException(409, {
      message: `Sprint "${sprintName}" already exists in this project`,
    });
  }

  const [maxPosition] = await db
    .select({
      maxPosition: sql<number>`COALESCE(MAX(${sprintTable.position}), -1)`,
    })
    .from(sprintTable)
    .where(eq(sprintTable.projectId, projectId));

  let created: typeof sprintTable.$inferSelect | undefined;
  try {
    [created] = await db
      .insert(sprintTable)
      .values({
        projectId,
        name: sprintName,
        goal: goal ?? null,
        status: "future",
        startDate: start,
        endDate: end,
        position: (maxPosition?.maxPosition ?? -1) + 1,
      })
      .returning();
  } catch (error) {
    // The name check above races a concurrent create; the unique constraint is
    // the final authority and must surface as a 409, not a 500.
    if (
      isDatabaseUniqueViolation(error) &&
      error.constraint === "sprint_project_name_unique"
    ) {
      throw new HTTPException(409, {
        message: `Sprint "${sprintName}" already exists in this project`,
      });
    }
    throw error;
  }

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create sprint" });
  }

  await publishEvent("sprint.updated", {
    projectId: created.projectId,
    sprintId: created.id,
  });

  return getSprint(created.projectId, created.id);
}

export default createSprint;
