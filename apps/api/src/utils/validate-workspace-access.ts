import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";

export async function validateWorkspaceAccess(
  userId: string,
  workspaceId: string,
  apiKeyId?: string,
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

  if (apiKeyId) {
    const apiKey = await db
      .select()
      .from(schema.apikeyTable)
      .where(
        and(
          eq(schema.apikeyTable.id, apiKeyId),
          eq(schema.apikeyTable.userId, userId),
          eq(schema.apikeyTable.enabled, true),
        ),
      )
      .limit(1);

    if (apiKey.length === 0) {
      throw new HTTPException(403, {
        message: "Invalid API key for this workspace",
      });
    }
  }
}
