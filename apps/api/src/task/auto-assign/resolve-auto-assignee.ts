import { eq } from "drizzle-orm";
import type { Context } from "hono";
import db from "../../database";
import { userTable } from "../../database/schema";
import { hasWorkspacePermission } from "../../utils/require-workspace-permission";

/**
 * The caller, when they opted in to auto-assign and may assign tasks in the
 * request's workspace (role and API key scope); otherwise null. Never an
 * authorization bypass: without task:assign nothing is assigned.
 */
export async function resolveAutoAssignee(c: Context): Promise<string | null> {
  const userId = c.get("userId");
  if (!userId) return null;

  const [user] = await db
    .select({ autoAssignSelf: userTable.autoAssignSelf })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!user?.autoAssignSelf) return null;

  return (await hasWorkspacePermission(c, { task: ["assign"] }))
    ? userId
    : null;
}
