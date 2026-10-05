import { findInaccessibleProjectIds } from "./assert-project-access";
import { isProjectAccessRestricted } from "./is-project-access-restricted";
import { findWorkspaceProjectIds } from "./member-project-access";
import {
  isOwnerRole,
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
}): Promise<Resolution> {
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
    if (await isProjectAccessRestricted(request.workspaceId, request.actorId)) {
      return { ok: false, status: 403, message: GRANT_DENIED };
    }
    return { ok: true, access: { projectAccess, projectIds: [] } };
  }

  const projectIds = [...new Set(rawIds as string[])];
  const known = await findWorkspaceProjectIds(request.workspaceId, projectIds);
  if (known.length !== projectIds.length) {
    return {
      ok: false,
      status: 400,
      message: "Some selected projects don't belong to this workspace",
    };
  }

  const denied = await findInaccessibleProjectIds(request.actorId, projectIds);
  if (denied.length > 0) {
    return { ok: false, status: 403, message: GRANT_DENIED };
  }

  return { ok: true, access: { projectAccess, projectIds } };
}
