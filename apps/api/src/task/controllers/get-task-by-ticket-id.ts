import { and, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable, workspaceTable } from "../../database/schema";
import {
  isSameProjectKey,
  mayMatchProjectKey,
} from "../../project/project-key";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import type { PermissionMap } from "../../utils/role-permissions";
import { workspacePermissionGrants } from "../../utils/workspace-permission-grants";
import { workspaceIsActive } from "../../workspace/archive/active-workspace-sql";
import { TICKET_ID_PATTERN } from "../ticket-id";
import getTask from "./get-task";

export default async function getTaskByTicketId(
  ticketId: string,
  userId: string,
  {
    workspaceId,
    workspaceSlug,
    projectId,
  }: { workspaceId?: string; workspaceSlug?: string; projectId?: string } = {},
  apiKeyPermissions?: PermissionMap | null,
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

  const grants = await workspacePermissionGrants(userId, {
    apiKeyPermissions,
    workspaceIds: workspaceId ? [workspaceId] : undefined,
  });
  const taskRead = { task: ["read"] };
  const readableWorkspaceIds = grants.workspaceIds.filter((id) =>
    grants.allows(id, taskRead),
  );

  let slugWorkspaceIds: string[] | undefined;
  if (workspaceSlug) {
    const slugMatches = await db
      .select({ id: workspaceTable.id, slug: workspaceTable.slug })
      .from(workspaceTable)
      .where(sql`lower(${workspaceTable.slug}) = lower(${workspaceSlug})`);
    const readableMatches = slugMatches.filter((workspace) =>
      grants.allows(workspace.id, taskRead),
    );
    const exactMatch = readableMatches.find(
      (workspace) => workspace.slug === workspaceSlug,
    );
    slugWorkspaceIds = exactMatch
      ? [exactMatch.id]
      : readableMatches.map((workspace) => workspace.id);
    if (slugWorkspaceIds.length === 0) {
      throw new HTTPException(404, { message: "Task not found" });
    }
  }

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
        workspaceIsActive(projectTable.workspaceId),
        mayMatchProjectKey(projectKey),
        workspaceId ? eq(projectTable.workspaceId, workspaceId) : undefined,
        slugWorkspaceIds
          ? inArray(projectTable.workspaceId, slugWorkspaceIds)
          : undefined,
        projectId ? eq(projectTable.id, projectId) : undefined,
        grants.isInstanceAdmin
          ? undefined
          : inArray(projectTable.workspaceId, readableWorkspaceIds),
        projectAccessCondition(userId, projectTable.id),
      ),
    );

  const rank = (candidate: { archivedAt: Date | null }) =>
    candidate.archivedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const [matchedTask, nextMatch] = candidates
    .filter((candidate) => grants.allows(candidate.workspaceId, taskRead))
    .filter((candidate) => isSameProjectKey(candidate.slug, projectKey))
    .sort((a, b) => (rank(a) === rank(b) ? 0 : rank(a) > rank(b) ? -1 : 1));
  if (!matchedTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }
  if (nextMatch && rank(nextMatch) === rank(matchedTask)) {
    throw new HTTPException(409, {
      message: "Task ticket ID matches multiple accessible tasks",
    });
  }

  return {
    ...(await getTask(matchedTask.id)),
    workspaceId: matchedTask.workspaceId,
  };
}
