import { eq } from "drizzle-orm";
import db from "../database";
import { workspaceUserTable } from "../database/schema";

export async function listWorkspaceMemberIds(
  workspaceId: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.workspaceId, workspaceId));
  return rows.map((row) => row.userId);
}
