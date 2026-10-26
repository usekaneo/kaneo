import { APIError, getSessionFromCtx } from "better-auth/api";
import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../database";
import { rolesAllow, type StoredRolePermission } from "./role-permissions";
import { splitRoles } from "./split-roles";

type AuthContext = Parameters<typeof getSessionFromCtx>[0];

export async function readableNativeOrganizations(
  userId: string,
  workspaceIds: string[],
) {
  const ids = [...new Set(workspaceIds)];
  if (ids.length === 0) return new Set<string>();
  const members = await db
    .select({
      workspaceId: schema.workspaceUserTable.workspaceId,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.userId, userId),
        inArray(schema.workspaceUserTable.workspaceId, ids),
      ),
    );
  if (members.length === 0) return new Set<string>();
  const memberships = new Map<string, string>();
  for (const member of members) {
    if (!memberships.has(member.workspaceId)) {
      memberships.set(member.workspaceId, member.role);
    }
  }
  const roleNames = [...new Set([...memberships.values()].flatMap(splitRoles))];
  const storedRoles = roleNames.length
    ? await db
        .select({
          workspaceId: schema.workspaceRoleTable.workspaceId,
          role: schema.workspaceRoleTable.role,
          permission: schema.workspaceRoleTable.permission,
        })
        .from(schema.workspaceRoleTable)
        .where(
          and(
            inArray(schema.workspaceRoleTable.workspaceId, [
              ...memberships.keys(),
            ]),
            inArray(schema.workspaceRoleTable.role, roleNames),
          ),
        )
    : [];
  const byWorkspace = new Map<string, StoredRolePermission[]>();
  for (const stored of storedRoles) {
    const roles = byWorkspace.get(stored.workspaceId) ?? [];
    roles.push(stored);
    byWorkspace.set(stored.workspaceId, roles);
  }
  // Native organization routes require membership, even for instance admins.
  return new Set(
    [...memberships]
      .filter(([workspaceId, role]) =>
        rolesAllow(splitRoles(role), byWorkspace.get(workspaceId) ?? [], {
          workspace: ["read"],
        }),
      )
      .map(([workspaceId]) => workspaceId),
  );
}

export async function assertNativeOrganizationReadAllowed(
  ctx: AuthContext,
  viewer: {
    user: { id: string };
    session: {
      id?: string;
      activeOrganizationId?: unknown;
      activeTeamId?: unknown;
    };
  } | null,
) {
  const needsRead =
    [
      "/organization/get-full-organization",
      "/organization/list-members",
      "/organization/get-active-member",
      "/organization/set-active",
      "/organization/list-teams",
      "/organization/list-team-members",
      "/organization/set-active-team",
    ].includes(ctx.path ?? "") ||
    (ctx.path === "/organization/get-active-member-role" && ctx.query?.userId);
  if (!needsRead) return;
  if (!viewer) return; // Provider retains its normal authentication failure.
  // get-active-member ignores query parameters in the provider.
  const input =
    ctx.path === "/organization/get-active-member"
      ? undefined
      : ctx.path === "/organization/set-active" ||
          ctx.path === "/organization/set-active-team"
        ? ctx.body
        : ctx.query;
  if (ctx.path === "/organization/set-active" && input?.organizationId === null)
    return;
  let workspaceId =
    input?.organizationId || viewer.session.activeOrganizationId;
  if (
    ctx.path === "/organization/list-team-members" ||
    ctx.path === "/organization/set-active-team"
  ) {
    if (ctx.path === "/organization/set-active-team" && input?.teamId === null)
      return;
    const teamId = input?.teamId || viewer.session.activeTeamId;
    if (!teamId) return;
    const [team] = await db
      .select({ workspaceId: schema.teamTable.workspaceId })
      .from(schema.teamTable)
      .where(eq(schema.teamTable.id, teamId))
      .limit(1);
    workspaceId = team?.workspaceId;
    if (!workspaceId) return; // Provider reports team-not-found, with no data.
  }
  // Full/member reads give slug precedence over ID; set-active prefers ID.
  if (
    input?.organizationSlug &&
    [
      "/organization/get-full-organization",
      "/organization/list-members",
      "/organization/get-active-member-role",
      "/organization/set-active",
    ].includes(ctx.path ?? "") &&
    (ctx.path !== "/organization/set-active" || !input.organizationId)
  ) {
    const [workspace] = await db
      .select({ id: schema.workspaceTable.id })
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.slug, input.organizationSlug))
      .limit(1);
    workspaceId = workspace?.id;
  }
  // Keep the provider's null/no-active-organization behavior when there is no
  // target. An explicitly supplied missing slug still fails closed.
  if (!workspaceId && !input?.organizationSlug) return;
  if (
    typeof workspaceId !== "string" ||
    !(await readableNativeOrganizations(viewer.user.id, [workspaceId])).has(
      workspaceId,
    )
  ) {
    throw new APIError("FORBIDDEN", {
      code: "MISSING_PERMISSION",
      message: "Workspace read permission is required",
    });
  }
}
