import { and, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { HTTPException } from "hono/http-exception";
import { requireWorkspaceEntitlement } from "../../billing/controllers/require-entitlement";
import { ApiError } from "../../errors/api-error";
import { WORKSPACE_ARCHIVED } from "../../workspace/archive/workspace-archived-error";
import { assertAgentAccess } from "../access";

export type OwnerAccess = "ok" | "lost" | "unavailable";

// Runs execute as the owner with their current permissions. Losing
// membership, project access, or the account pauses the automation; an
// archived workspace skips runs until it is restored; lost entitlement pauses.
export async function checkOwnerAccess(automation: {
  ownerId: string;
  workspaceId: string;
  projectId: string | null;
}): Promise<OwnerAccess> {
  const [member] = await db
    .select({ id: schema.workspaceUserTable.id })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.userId, automation.ownerId),
        eq(schema.workspaceUserTable.workspaceId, automation.workspaceId),
      ),
    )
    .limit(1);
  if (!member) return "lost";
  try {
    await assertAgentAccess({
      userId: automation.ownerId,
      workspaceId: automation.workspaceId,
      projectId: automation.projectId,
    });
    await requireWorkspaceEntitlement(automation.workspaceId);
    return "ok";
  } catch (error) {
    if (error instanceof ApiError && error.code === WORKSPACE_ARCHIVED)
      return "unavailable";
    if (error instanceof HTTPException && error.status === 402) return "lost";
    if (
      error instanceof HTTPException &&
      (error.status === 403 || error.status === 404)
    )
      return "lost";
    throw error;
  }
}
