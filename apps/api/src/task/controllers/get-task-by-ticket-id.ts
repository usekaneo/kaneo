import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import {
  isSameProjectKey,
  mayMatchProjectKey,
} from "../../project/project-key";
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
  const projectKey = match?.[1];
  const number = Number(match?.[2]);
  if (
    !projectKey ||
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

  const candidates = await db
    .select({
      id: taskTable.id,
      workspaceId: projectTable.workspaceId,
      slug: projectTable.slug,
      archivedAt: projectTable.archivedAt,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskTable.number, number),
        mayMatchProjectKey(projectKey),
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
    );

  const [matchedTask, nextMatch] = candidates
    .filter((candidate) => isSameProjectKey(candidate.slug, projectKey))
    .sort(
      (a, b) => Number(Boolean(a.archivedAt)) - Number(Boolean(b.archivedAt)),
    );
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
