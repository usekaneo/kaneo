import db from "../database";
import { publishEvent } from "../events";
import { listAccessibleProjectIds } from "./list-accessible-project-ids";

export async function publishMemberProjects(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const projectIds = await listAccessibleProjectIds(db, workspaceId, userId);
  await publishEvent("project_members.updated", {
    workspaceId,
    projectIds: [...projectIds],
  });
}
