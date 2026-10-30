import { syncWorkspaceSeats } from "../billing/controllers/sync-seats";
import { publishMemberProjects } from "../project-access/publish-member-projects";

export async function handleMemberAdded(workspaceId: string, userId: string) {
  await publishMemberProjects(workspaceId, userId).catch((error) => {
    console.error("Project member refresh failed:", error);
  });
  void syncWorkspaceSeats(workspaceId).catch((error) => {
    console.error("Seat sync after member add failed:", error);
  });
}
