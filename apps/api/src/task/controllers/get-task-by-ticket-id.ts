import { and, eq, ilike, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { escapeLikePattern } from "../../search/like-pattern";
import { TASK_SHORT_ID_PATTERN } from "../../search/task-short-id";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import getTask from "./get-task";

export default async function getTaskByTicketId(
  ticketId: string,
  userId: string,
  workspaceId?: string,
  projectId?: string,
) {
  const match = ticketId.normalize("NFKC").match(TASK_SHORT_ID_PATTERN);
  const number = Number(match?.[2]);
  if (
    !match?.[1] ||
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > 2_147_483_647
  ) {
    throw new HTTPException(400, { message: "Invalid task ticket ID" });
  }

  const [user] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  const memberWorkspaces = db
    .select({ workspaceId: workspaceUserTable.workspaceId })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.userId, userId));

  const matches = await db
    .select({ id: taskTable.id })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        ilike(projectTable.slug, escapeLikePattern(match[1])),
        eq(taskTable.number, number),
        workspaceId ? eq(projectTable.workspaceId, workspaceId) : undefined,
        projectId ? eq(projectTable.id, projectId) : undefined,
        hasInstanceAdminRole(user?.role)
          ? undefined
          : inArray(projectTable.workspaceId, memberWorkspaces),
      ),
    )
    .limit(2);

  const matchedTask = matches[0];
  if (!matchedTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }
  if (matches.length > 1) {
    throw new HTTPException(409, {
      message: "Task ticket ID matches multiple accessible tasks",
    });
  }

  return getTask(matchedTask.id);
}
