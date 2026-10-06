import { getMemberProjectAccess } from "../../project-access/get-member-project-access";
import { isProjectAccessRestricted } from "../../project-access/is-project-access-restricted";

async function getMyProjectAccess(workspaceId: string, userId: string) {
  if (!(await isProjectAccessRestricted(workspaceId, userId))) {
    return { userId, projectAccess: "all" as const, projectIds: [] };
  }
  return getMemberProjectAccess(workspaceId, userId);
}

export default getMyProjectAccess;
