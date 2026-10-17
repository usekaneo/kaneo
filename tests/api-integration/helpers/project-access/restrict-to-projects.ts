import db from "../../../../apps/api/src/database";
import { replaceMemberProjectAccess } from "../../../../apps/api/src/project-access/replace-member-project-access";

export async function restrictToProjects(
  workspaceId: string,
  userId: string,
  projectIds: string[],
) {
  await replaceMemberProjectAccess(db, {
    workspaceId,
    userId,
    projectAccess: "selected",
    projectIds,
  });
}
