import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import {
  WORKSPACE_ARCHIVED,
  WORKSPACE_ARCHIVED_MESSAGE,
} from "./workspace-archived-error";

// Endpoints that never act on one existing workspace. The list endpoints hide
// archived workspaces in the after hook instead.
const UNSCOPED_PATHS = new Set([
  "/organization/create",
  "/organization/check-slug",
  "/organization/list",
  "/organization/list-user-invitations",
  "/organization/list-user-teams",
]);

type OrganizationContext = {
  path?: string;
  body?: Record<string, unknown> | null;
  query?: Record<string, unknown> | null;
};

type OrganizationViewer = {
  user: { id: string };
  session: { activeOrganizationId?: unknown };
} | null;

type Target = { workspaceId: string; viaInvitation: boolean };

async function workspaceIdBySlug(slug: string) {
  const [row] = await db
    .select({ id: schema.workspaceTable.id })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.slug, slug))
    .limit(1);
  return row?.id;
}

async function workspaceIdByTeam(teamId: string) {
  const [row] = await db
    .select({ workspaceId: schema.teamTable.workspaceId })
    .from(schema.teamTable)
    .where(eq(schema.teamTable.id, teamId))
    .limit(1);
  return row?.workspaceId;
}

/**
 * Finds the workspace a Better Auth organization request acts on. Returns null
 * when the request names a target that does not exist (the provider reports
 * that) or has no target at all.
 */
async function resolveTarget(
  ctx: OrganizationContext,
  viewer: NonNullable<OrganizationViewer>,
): Promise<Target | null> {
  const input =
    ctx.path === "/organization/get-active-member"
      ? {}
      : { ...ctx.query, ...ctx.body };
  const text = (key: string) =>
    typeof input[key] === "string" && input[key] ? input[key] : undefined;

  if (ctx.path === "/organization/set-active" && input.organizationId === null)
    return null;

  const invitationId =
    text("invitationId") ??
    (ctx.path === "/organization/get-invitation" ? text("id") : undefined);
  if (invitationId) {
    const [invitation] = await db
      .select({ workspaceId: schema.invitationTable.workspaceId })
      .from(schema.invitationTable)
      .where(eq(schema.invitationTable.id, invitationId))
      .limit(1);
    return invitation
      ? { workspaceId: invitation.workspaceId, viaInvitation: true }
      : null;
  }

  const slugWins =
    [
      "/organization/get-full-organization",
      "/organization/list-members",
      "/organization/get-active-member-role",
    ].includes(ctx.path ?? "") && text("organizationSlug");
  const organizationId = slugWins ? undefined : text("organizationId");
  const organizationSlug = text("organizationSlug");
  const teamId = text("teamId");
  const explicit = organizationId ?? organizationSlug ?? teamId;
  const workspaceId = organizationId
    ? organizationId
    : organizationSlug
      ? await workspaceIdBySlug(organizationSlug)
      : teamId
        ? await workspaceIdByTeam(teamId)
        : undefined;
  if (explicit) {
    return workspaceId ? { workspaceId, viaInvitation: false } : null;
  }

  if (ctx.path === "/organization/set-active-team" && input.teamId === null)
    return null;
  const active = viewer.session.activeOrganizationId;
  return typeof active === "string" && active
    ? { workspaceId: active, viaInvitation: false }
    : null;
}

/**
 * Blocks Better Auth organization endpoints (reads, member changes, invitation
 * acceptance, set-active, ...) for archived workspaces.
 */
export async function assertNativeOrganizationActive(
  ctx: OrganizationContext,
  viewer: OrganizationViewer,
) {
  if (!ctx.path?.startsWith("/organization/") || UNSCOPED_PATHS.has(ctx.path))
    return;
  if (!viewer) return; // Provider retains its normal authentication failure.

  const target = await resolveTarget(ctx, viewer);
  if (!target) return;

  const [row] = await db
    .select({
      archivedAt: schema.workspaceTable.archivedAt,
      memberId: schema.workspaceUserTable.id,
      instanceRole: schema.userTable.role,
    })
    .from(schema.workspaceTable)
    .leftJoin(schema.userTable, eq(schema.userTable.id, viewer.user.id))
    .leftJoin(
      schema.workspaceUserTable,
      and(
        eq(schema.workspaceUserTable.workspaceId, schema.workspaceTable.id),
        eq(schema.workspaceUserTable.userId, viewer.user.id),
      ),
    )
    .where(eq(schema.workspaceTable.id, target.workspaceId))
    .limit(1);
  if (!row?.archivedAt) return;

  // Invitees and members learn why; anyone else gets the provider's usual
  // permission failure so archived workspaces stay indistinguishable.
  if (
    target.viaInvitation ||
    row.memberId ||
    hasInstanceAdminRole(row.instanceRole)
  ) {
    throw new APIError("FORBIDDEN", {
      code: WORKSPACE_ARCHIVED,
      message: WORKSPACE_ARCHIVED_MESSAGE,
    });
  }
  throw new APIError("FORBIDDEN", {
    code: "MISSING_PERMISSION",
    message: "Workspace read permission is required",
  });
}
