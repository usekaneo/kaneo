import type { DbOrTx } from "./db-or-tx";
import { findInaccessibleProjectIds } from "./find-inaccessible-project-ids";
import { isProjectAccessRestricted } from "./is-project-access-restricted";
import { getMemberProjectAccess } from "./get-member-project-access";
import type { ResolvedProjectAccess } from "./resolve-project-access-request";

type Outcome =
  | { ok: true; access: ResolvedProjectAccess }
  | { ok: false; message: string };

export async function keepHiddenGrants(request: {
  workspaceId: string;
  actorId: string;
  userId: string;
  access: ResolvedProjectAccess;
  database: DbOrTx;
}): Promise<Outcome> {
  const { workspaceId, actorId, userId, access, database } = request;

  if (!(await isProjectAccessRestricted(workspaceId, actorId, database))) {
    return { ok: true, access };
  }

  const current = await getMemberProjectAccess(workspaceId, userId, database);
  if (current.projectAccess === "all") {
    return {
      ok: false,
      message:
        "You can't limit a member who can access every project while your own access is limited",
    };
  }

  const hidden = await findInaccessibleProjectIds(
    actorId,
    current.projectIds,
    database,
  );
  return {
    ok: true,
    access: {
      projectAccess: access.projectAccess,
      projectIds: [...new Set([...access.projectIds, ...hidden])],
    },
  };
}
