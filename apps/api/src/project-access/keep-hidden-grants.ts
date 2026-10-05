import { findInaccessibleProjectIds } from "./assert-project-access";
import { isProjectAccessRestricted } from "./is-project-access-restricted";
import { getMemberProjectAccess } from "./member-project-access";
import type { ResolvedProjectAccess } from "./resolve-project-access-request";

type Outcome =
  | { ok: true; access: ResolvedProjectAccess }
  | { ok: false; message: string };

export async function keepHiddenGrants(request: {
  workspaceId: string;
  actorId: string;
  userId: string;
  access: ResolvedProjectAccess;
}): Promise<Outcome> {
  const { workspaceId, actorId, userId, access } = request;

  if (!(await isProjectAccessRestricted(workspaceId, actorId))) {
    return { ok: true, access };
  }

  const current = await getMemberProjectAccess(workspaceId, userId);
  if (current.projectAccess === "all") {
    return {
      ok: false,
      message:
        "You can't limit a member who can access every project while your own access is limited",
    };
  }

  const hidden = await findInaccessibleProjectIds(actorId, current.projectIds);
  return {
    ok: true,
    access: {
      projectAccess: access.projectAccess,
      projectIds: [...new Set([...access.projectIds, ...hidden])],
    },
  };
}
