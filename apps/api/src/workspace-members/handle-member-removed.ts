import { syncWorkspaceSeats } from "../billing/controllers/sync-seats";
import { publishEvent } from "../events";
import { clearMemberProjectAccess } from "../project-access/clear-member-project-access";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import { revokeWorkspaceConnections } from "../ws";

export async function handleMemberRemoved(removal: {
  workspaceId: string;
  userId: string;
  userRole: string | null | undefined;
}) {
  const { workspaceId, userId, userRole } = removal;
  await clearMemberProjectAccess(workspaceId, userId).catch((error) => {
    console.error("Project access cleanup failed:", error);
  });
  await publishEvent("project_members.updated", { workspaceId });
  if (!hasInstanceAdminRole(userRole)) {
    await revokeWorkspaceConnections(userId, workspaceId, {
      role: userRole ?? null,
    });
  }
  void syncWorkspaceSeats(workspaceId).catch((error) => {
    console.error("Seat sync after member remove failed:", error);
  });
}
