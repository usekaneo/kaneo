import { and, eq, inArray } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { ApiError } from "../errors/api-error";
import { isInstanceAdmin } from "./is-instance-admin";
import { missingPermissions } from "./missing-permissions";
import {
  type PermissionMap,
  rolesAllow,
  rolesMissingPermissions,
  type StoredRolePermission,
  satisfies,
} from "./role-permissions";
import { splitRoles } from "./split-roles";

async function storedRolePermissions(
  workspaceId: string,
  roles: string[],
  database: Pick<typeof db, "select">,
): Promise<StoredRolePermission[]> {
  if (roles.length === 0) return [];
  return database
    .select({
      role: schema.workspaceRoleTable.role,
      permission: schema.workspaceRoleTable.permission,
    })
    .from(schema.workspaceRoleTable)
    .where(
      and(
        eq(schema.workspaceRoleTable.workspaceId, workspaceId),
        inArray(schema.workspaceRoleTable.role, roles),
      ),
    );
}

function apiKeyPermissions(c: Context) {
  const apiKey = c.get("apiKey") as
    | { permissions?: Record<string, string[]> | null }
    | undefined;
  return apiKey?.permissions ?? null;
}

function assertApiKeyScope(c: Context, permissions: PermissionMap) {
  const scope = apiKeyPermissions(c);
  if (scope && !satisfies(scope, permissions)) {
    throw new ApiError(403, {
      message: "Insufficient API key scope",
      code: "API_KEY_SCOPE",
      missingPermissions: missingPermissions(scope, permissions),
    });
  }
}

export async function roleHasWorkspacePermission(
  workspaceId: string,
  role: string,
  permissions: PermissionMap,
  database: Pick<typeof db, "select"> = db,
) {
  const roles = splitRoles(role);
  return rolesAllow(
    roles,
    await storedRolePermissions(workspaceId, roles, database),
    permissions,
  );
}

export async function hasWorkspacePermission(
  c: Context,
  permissions: PermissionMap,
  // Checks a workspace other than the one the request authorized against.
  // Needed when a single request touches two workspaces (e.g. moving a
  // project), since the access middleware only resolves one.
  workspaceIdOverride?: string,
) {
  const workspaceId = workspaceIdOverride ?? c.get("workspaceId");
  if (!workspaceId) return false;

  const scope = apiKeyPermissions(c);
  if (scope && !satisfies(scope, permissions)) {
    return false;
  }

  if (await isInstanceAdmin(c)) {
    return true;
  }

  const { roles, stored } = await memberRoles(c, workspaceId);
  return rolesAllow(roles, stored, permissions);
}

async function memberRoles(
  c: Context,
  workspaceId: string,
): Promise<{ roles: string[]; stored: StoredRolePermission[] }> {
  const userId = c.get("userId");
  if (!userId) return { roles: [], stored: [] };

  const [member] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);

  // Prefer the DB row when present so admin-edited defaults
  // (viewer/member/admin) take effect immediately. Falls back to the
  // compiled-in static definitions only when no row exists, which protects
  // viewer/member/admin users from a 403 if their workspace somehow
  // missed the seed (e.g., seed failed during workspace creation and
  // the boot-time backfill hasn't run yet).
  const roles = splitRoles(member?.role);
  return {
    roles,
    stored: await storedRolePermissions(workspaceId, roles, db),
  };
}

export function requireApiKeyScope(permissions: PermissionMap) {
  return async (c: Context, next: Next) => {
    assertApiKeyScope(c, permissions);
    return next();
  };
}

export function requireWorkspacePermission(permissions: PermissionMap) {
  return async (c: Context, next: Next) => {
    const workspaceId = c.get("workspaceId");
    if (!workspaceId) {
      throw new HTTPException(500, {
        message: "workspaceId not set in context",
      });
    }

    assertApiKeyScope(c, permissions);

    if (await isInstanceAdmin(c)) {
      return next();
    }

    if (!c.get("userId")) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const { roles, stored } = await memberRoles(c, workspaceId);
    if (!rolesAllow(roles, stored, permissions)) {
      throw new ApiError(403, {
        message: "Insufficient permissions",
        code: "MISSING_PERMISSION",
        missingPermissions: rolesMissingPermissions(roles, stored, permissions),
      });
    }

    return next();
  };
}
