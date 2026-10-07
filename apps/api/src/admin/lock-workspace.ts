import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";

export async function lockWorkspace(database: DbOrTx, workspaceId: string) {
  const [workspace] = await database
    .select({ id: schema.workspaceTable.id })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, workspaceId))
    .for("update");
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  return database
    .select({
      userId: schema.workspaceUserTable.userId,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .where(eq(schema.workspaceUserTable.workspaceId, workspaceId))
    .orderBy(schema.workspaceUserTable.id)
    .for("update");
}
