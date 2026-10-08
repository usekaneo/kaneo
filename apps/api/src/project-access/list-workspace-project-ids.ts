import { eq } from "drizzle-orm";
import db, { schema } from "../database";

export async function listWorkspaceProjectIds(
  workspaceId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: schema.projectTable.id })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.workspaceId, workspaceId));
  return rows.map((row) => row.id);
}
