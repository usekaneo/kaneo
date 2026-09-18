import { recordAudit } from "./record-audit";

// Better Auth endpoints that change who can do what in a workspace.
const PERMISSION_ACTIONS: Record<string, string> = {
  "/organization/invite-member": "member.invited",
  "/organization/update-member-role": "member.role_changed",
  "/organization/remove-member": "member.removed",
  "/organization/create-role": "role.created",
  "/organization/update-role": "role.updated",
  "/organization/delete-role": "role.deleted",
};

type AfterContext = {
  path: string;
  body?: Record<string, unknown> | null;
  returned?: unknown;
  actorId?: string | null;
  activeWorkspaceId?: string | null;
};

function isFailure(returned: unknown) {
  if (!returned) return true;
  if (returned instanceof Error) return true;
  const status = (returned as { status?: unknown; statusCode?: unknown })
    .statusCode;
  return typeof status === "number" && status >= 400;
}

/** Audit log entry for a successful permission change made through auth. */
export async function auditAuthChange(ctx: AfterContext) {
  const action = PERMISSION_ACTIONS[ctx.path];
  if (!action || isFailure(ctx.returned)) return;
  const body = ctx.body ?? {};
  const workspaceId =
    (body.organizationId as string | undefined) ?? ctx.activeWorkspaceId;
  if (!workspaceId) return;

  // Only names and roles; never tokens or invitation links.
  const data: Record<string, unknown> = {};
  for (const key of [
    "role",
    "email",
    "memberId",
    "memberIdOrEmail",
    "roleName",
    "roleId",
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.permission !== undefined) data.permission = body.permission;
  if (
    body.data &&
    typeof body.data === "object" &&
    "permission" in (body.data as Record<string, unknown>)
  ) {
    data.permission = (body.data as Record<string, unknown>).permission;
  }

  await recordAudit({
    workspaceId,
    actorId: ctx.actorId ?? null,
    action,
    targetType: action.startsWith("role.") ? "role" : "member",
    targetId: (body.memberId as string | undefined) ?? null,
    data,
  });
}
