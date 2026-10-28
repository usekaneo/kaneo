import db from "../database";
import type { DbOrTx } from "./db-or-tx";
import { findInaccessibleProjectIds } from "./find-inaccessible-project-ids";
import { isProjectAccessRestricted } from "./is-project-access-restricted";
import { findWorkspaceProjectIds } from "./find-workspace-project-ids";
import { isOwnerRole } from "./is-owner-role";
import {
  isProjectAccessMode,
  type ProjectAccessMode,
} from "./project-access-mode";

export type ResolvedProjectAccess = {
  projectAccess: ProjectAccessMode;
  projectIds: string[];
};

type Resolution =
  | { ok: true; access: ResolvedProjectAccess }
  | { ok: false; status: 400 | 403; message: string };

const GRANT_DENIED =
  "You can only give access to projects you can access yourself";

export async function resolveProjectAccessRequest(request: {
  workspaceId: string;
  actorId: string;
  targetRole: string | null | undefined;
  projectAccess: unknown;
  projectIds: unknown;
  database?: DbOrTx;
}): Promise<Resolution> {
  const database = request.database ?? db;
  const projectAccess = request.projectAccess ?? "all";
  if (!isProjectAccessMode(projectAccess)) {
    return {
      ok: false,
      status: 400,
      message: 'Project access must be "all" or "selected"',
    };
  }

  const rawIds = request.projectIds ?? [];
  if (!Array.isArray(rawIds) || rawIds.some((id) => typeof id !== "string")) {
    return {
      ok: false,
      status: 400,
      message: "Project IDs must be a list of strings",
    };
  }

  if (projectAccess === "selected" && isOwnerRole(request.targetRole)) {
    return {
      ok: false,
      status: 400,
      message: "Owners always have access to every project",
    };
  }

  if (projectAccess === "all") {
    if (
      await isProjectAccessRestricted(
        request.workspaceId,
        request.actorId,
        database,
      )
    ) {
      return { ok: false, status: 403, message: GRANT_DENIED };
    }
    return { ok: true, access: { projectAccess, projectIds: [] } };
  }

  const projectIds = [...new Set(rawIds as string[])];
  const known = await findWorkspaceProjectIds(
    request.workspaceId,
    projectIds,
    database,
  );
  if (known.length !== projectIds.length) {
    return {
      ok: false,
      status: 400,
      message: "Some selected projects don't belong to this workspace",
    };
  }

  const denied = await findInaccessibleProjectIds(
    request.actorId,
    projectIds,
    database,
  );
  if (denied.length > 0) {
    return { ok: false, status: 403, message: GRANT_DENIED };
  }

  return { ok: true, access: { projectAccess, projectIds } };
}
