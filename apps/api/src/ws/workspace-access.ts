import { and, eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import db from "../database";
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../database/schema";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";

export async function syncWorkspaceAccess(userId: string, ws: WSContext) {
  try {
    const [user] = await db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId));
    if (!user) {
      ws.close(1008, "User access revoked");
      return;
    }
    // Administrators need an existing-workspace snapshot too: an unrestricted
    // marker cannot remove a workspace deleted while their socket was offline.
    const workspaces = hasInstanceAdminRole(user.role)
      ? await db
          .select({ workspaceId: workspaceTable.id })
          .from(workspaceTable)
          .where(undefined)
      : await db
          .select({ workspaceId: workspaceUserTable.workspaceId })
          .from(workspaceUserTable)
          .where(eq(workspaceUserTable.userId, userId));
    ws.send(
      JSON.stringify({
        type: "WORKSPACE_ACCESS_SYNC",
        workspaceIds: workspaces.map((workspace) => workspace.workspaceId),
      }),
    );
  } catch (error) {
    console.error("Failed to synchronize workspace access:", error);
    ws.close(1011, "Workspace access synchronization failed");
  }
}

export async function hasWorkspaceAccess(userId: string, workspaceId: string) {
  const [[user], members] = await Promise.all([
    db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId)),
    db
      .select({ userId: workspaceUserTable.userId })
      .from(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.userId, userId),
          eq(workspaceUserTable.workspaceId, workspaceId),
        ),
      ),
  ]);
  return !!user && (hasInstanceAdminRole(user.role) || members.length > 0);
}
