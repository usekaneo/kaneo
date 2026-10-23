import { and, asc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import db from "../../database";
import { labelTable, taskTable, userTable } from "../../database/schema";
import type { PermissionMap } from "../../utils/role-permissions";
import { VIRTUAL_STATUSES } from "../validate-task-fields";
import { loadBoardScope } from "./board-scope";

// Filter menus list at most this many assignees and labels.
const FILTER_OPTION_LIMIT = 200;

async function getGlobalBoardMeta(
  userId: string,
  apiKeyScope: PermissionMap | null,
) {
  const { workspaces, projects } = await loadBoardScope(userId, apiKeyScope);
  if (projects.length === 0)
    return { workspaces, projects, assignees: [], labels: [] };

  const labelName = sql<string>`lower(${labelTable.name})`;
  const [assignees, labels] = await Promise.all([
    // Only people already visible on a task the caller can read.
    db
      .selectDistinct({
        id: userTable.id,
        name: userTable.name,
        image: userTable.image,
      })
      .from(taskTable)
      .innerJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(
        and(
          inArray(
            taskTable.projectId,
            projects.map((project) => project.id),
          ),
          notInArray(taskTable.status, [...VIRTUAL_STATUSES]),
        ),
      )
      .orderBy(asc(userTable.name), asc(userTable.id))
      .limit(FILTER_OPTION_LIMIT),
    db
      .selectDistinctOn([labelName], {
        name: labelTable.name,
        color: labelTable.color,
      })
      .from(labelTable)
      .where(
        and(
          inArray(
            labelTable.workspaceId,
            workspaces.map((workspace) => workspace.id),
          ),
          isNull(labelTable.taskId),
          isNull(labelTable.deletionStartedAt),
        ),
      )
      .orderBy(labelName, asc(labelTable.createdAt))
      .limit(FILTER_OPTION_LIMIT),
  ]);

  return { workspaces, projects, assignees, labels };
}

export default getGlobalBoardMeta;
