import { asc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable, taskTable } from "../../database/schema";
import { taskIsCompleted } from "../../task/task-is-completed";

// Counts live in the list response: the sprint board and the close-sprint
// wizard both need to know how many tasks a sprint holds and how many of them
// are already done.
export async function getSprintList(projectId: string) {
  return db
    .select({
      id: sprintTable.id,
      projectId: sprintTable.projectId,
      name: sprintTable.name,
      goal: sprintTable.goal,
      status: sprintTable.status,
      startDate: sprintTable.startDate,
      endDate: sprintTable.endDate,
      carryOverTasks: sprintTable.carryOverTasks,
      position: sprintTable.position,
      createdAt: sprintTable.createdAt,
      updatedAt: sprintTable.updatedAt,
      taskCount: sql<number>`count(${taskTable.id})`.mapWith(Number),
      completedTaskCount:
        sql<number>`count(${taskTable.id}) filter (where ${taskIsCompleted})`.mapWith(
          Number,
        ),
    })
    .from(sprintTable)
    .leftJoin(taskTable, eq(taskTable.sprintId, sprintTable.id))
    .where(eq(sprintTable.projectId, projectId))
    .groupBy(sprintTable.id)
    .orderBy(asc(sprintTable.position));
}

/** Loads one sprint from the list view, so every sprint response carries counts. */
export async function getSprint(projectId: string, sprintId: string) {
  const sprints = await getSprintList(projectId);
  const sprint = sprints.find((item) => item.id === sprintId);

  if (!sprint) {
    throw new HTTPException(404, { message: "Sprint not found" });
  }

  return sprint;
}

async function getSprints(projectId: string) {
  return getSprintList(projectId);
}

export default getSprints;
