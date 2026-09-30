import { eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import db from "../database";
import { userTable, workspaceUserTable } from "../database/schema";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";

export async function syncWorkspaceAccess(userId: string, ws: WSContext) {
  try {
    const [[user], memberships] = await Promise.all([
      db
        .select({ role: userTable.role })
        .from(userTable)
        .where(eq(userTable.id, userId)),
      db
        .select({ workspaceId: workspaceUserTable.workspaceId })
        .from(workspaceUserTable)
        .where(eq(workspaceUserTable.userId, userId)),
    ]);
    if (!user) {
      ws.close(1008, "User access revoked");
      return;
    }
    ws.send(
      JSON.stringify({
        type: "WORKSPACE_ACCESS_SYNC",
        workspaceIds: hasInstanceAdminRole(user.role)
          ? null
          : memberships.map((member) => member.workspaceId),
      }),
    );
  } catch (error) {
    console.error("Failed to synchronize workspace access:", error);
    ws.close(1011, "Workspace access synchronization failed");
  }
}
