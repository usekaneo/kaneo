import { eq } from "drizzle-orm";
import db from "../database";
import { workspaceTable } from "../database/schema";
import { hasWorkspaceAccess } from "./workspace-access";

export async function workspaceRevocationIsCurrent(
  userId: string,
  workspaceId: string,
  reason?: unknown,
) {
  if (reason === "archived") {
    const [workspace] = await db
      .select({ archivedAt: workspaceTable.archivedAt })
      .from(workspaceTable)
      .where(eq(workspaceTable.id, workspaceId));
    return !!workspace?.archivedAt;
  }
  return !(await hasWorkspaceAccess(userId, workspaceId));
}
