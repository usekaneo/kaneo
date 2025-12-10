import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";

/**
 * Validates that a user has access to a workspace
 * @param userId - The user's ID
 * @param workspaceId - The workspace ID to check
 * @throws HTTPException with 403 if user doesn't have access
 */
export async function validateWorkspaceAccess(
  userId: string,
  workspaceId: string,
): Promise<void> {
  const membership = await db
    .select()
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.userId, userId),
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (membership.length === 0) {
    throw new HTTPException(403, {
      message: "You don't have access to this workspace",
    });
  }
}
