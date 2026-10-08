import { and, eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { isInstanceAdmin } from "./is-instance-admin";
import { type PermissionMap, roleAllows, satisfies } from "./role-permissions";

async function storedRolePermission(
  workspaceId: string,
  role: string,
  database: Pick<typeof db, "select"> = db,
): Promise<string | null> {
  const [row] = await database
    .select({ permission: schema.workspaceRoleTable.permission })
    .from(schema.workspaceRoleTable)
    .where(
      and(
        eq(schema.workspaceRoleTable.workspaceId, workspaceId),
        eq(schema.workspaceRoleTable.role, role),
      ),
    )
    .limit(1);

  return row?.permission ?? null;
}

function apiKeyAllows(c: Context, permissions: PermissionMap) {
  const apiKey = c.get("apiKey") as
    | { permissions?: Record<string, string[]> | null }
    | undefined;
  return !apiKey?.permissions || satisfies(apiKey.permissions, permissions);
}

function assertApiKeyScope(c: Context, permissions: PermissionMap) {
  if (!apiKeyAllows(c, permissions)) {
    throw new HTTPException(403, { message: "Insufficient API key scope" });
  }
}

export async function roleHasWorkspacePermission(
  workspaceId: string,
  role: string,
  permissions: PermissionMap,
  database: Pick<typeof db, "select"> = db,
) {
  return roleAllows(
    role,
    await storedRolePermission(workspaceId, role, database),
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

  if (!apiKeyAllows(c, permissions)) {
    return false;
  }

  if (await isInstanceAdmin(c)) {
    return true;
  }

  const userId = c.get("userId");
  if (!userId) return false;

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

  if (!member?.role) return false;

  // Prefer the DB row when present so admin-edited defaults
  // (viewer/member/admin) take effect immediately. Falls back to the
  // compiled-in static definitions only when no row exists, which protects
  // viewer/member/admin users from a 403 if their workspace somehow
  // missed the seed (e.g., seed failed during workspace creation and
  // the boot-time backfill hasn't run yet).
  return roleHasWorkspacePermission(workspaceId, member.role, permissions);
}

export function requireApiKeyScope(permissions: PermissionMap) {
  return async (c: Context, next: Next) => {
    assertApiKeyScope(c, permissions);
    return next();
  };
}

export function requireWorkspacePermission(permissions: PermissionMap) {
  return async (c: Context, next: Next) => {
    if (!c.get("workspaceId")) {
      throw new HTTPException(500, {
        message: "workspaceId not set in context",
      });
    }

    assertApiKeyScope(c, permissions);

    if (!(await hasWorkspacePermission(c, permissions))) {
      if (!c.get("userId")) {
        throw new HTTPException(401, { message: "Unauthorized" });
      }
      throw new HTTPException(403, { message: "Insufficient permissions" });
    }

    return next();
  };
}
