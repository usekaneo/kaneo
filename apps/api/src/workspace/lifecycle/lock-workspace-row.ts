import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "../../database";
import type { DbOrTx } from "../../project-access/db-or-tx";

/** Locks a workspace row for a lifecycle change and returns what it needs. */
export async function lockWorkspaceRow(database: DbOrTx, workspaceId: string) {
  const [workspace] = await database
    .select()
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, workspaceId))
    .for("update");
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }
  return workspace;
}
