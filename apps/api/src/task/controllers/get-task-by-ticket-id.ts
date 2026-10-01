import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { escapeLikePattern } from "../../search/like-pattern";
import { TICKET_ID_PATTERN } from "../ticket-id";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import getTask from "./get-task";

export default async function getTaskByTicketId(
  ticketId: string,
  userId: string,
  {
    workspaceId,
    workspaceSlug,
    projectId,
  }: { workspaceId?: string; workspaceSlug?: string; projectId?: string } = {},
) {
  const match = ticketId.normalize("NFKC").match(TICKET_ID_PATTERN);
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

  const keys = new Set([match[1], ticketId.match(TICKET_ID_PATTERN)?.[1]]);

  const matches = await db
    .select({
      id: taskTable.id,
      workspaceId: projectTable.workspaceId,
      archivedAt: projectTable.archivedAt,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        or(
          ...[...keys]
            .filter((key) => key !== undefined)
            .map((key) => ilike(projectTable.slug, escapeLikePattern(key))),
        ),
        eq(taskTable.number, number),
        workspaceId ? eq(projectTable.workspaceId, workspaceId) : undefined,
        workspaceSlug
          ? inArray(
              projectTable.workspaceId,
              db
                .select({ id: workspaceTable.id })
                .from(workspaceTable)
                .where(eq(workspaceTable.slug, workspaceSlug)),
            )
          : undefined,
        projectId ? eq(projectTable.id, projectId) : undefined,
        hasInstanceAdminRole(user?.role)
          ? undefined
          : inArray(projectTable.workspaceId, memberWorkspaces),
      ),
    )
    .orderBy(sql`${projectTable.archivedAt} is not null`)
    .limit(2);

  const [matchedTask, nextMatch] = matches;
  if (!matchedTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }
  if (nextMatch && (matchedTask.archivedAt || !nextMatch.archivedAt)) {
    throw new HTTPException(409, {
      message: "Task ticket ID matches multiple accessible tasks",
    });
  }

  return {
    ...(await getTask(matchedTask.id)),
    workspaceId: matchedTask.workspaceId,
  };
}
