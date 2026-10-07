import { publishEvent } from "../events";
import { clearMemberProjectAccess } from "../project-access/clear-member-project-access";

export async function handleOwnerPromoted(workspaceId: string, userId: string) {
  await clearMemberProjectAccess(workspaceId, userId)
    .then(() => publishEvent("project_access.updated", { workspaceId, userId }))
    .catch((error) => {
      console.error("Project access cleanup failed:", error);
    });
}
