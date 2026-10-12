import { and, inArray } from "drizzle-orm";
import db from "../database";
import { workspaceRoleTable } from "../database/schema";
import type { StoredRolePermission } from "../utils/role-permissions";
import { splitRoles } from "../utils/split-roles";
import { canReadWorkspace, type WorkspaceAccess } from "./can-read-workspace";

async function loadStoredRoles(rows: (WorkspaceAccess & { id: string })[]) {
  const pending = rows.filter((row) => !row.instanceAdmin);
  const workspaceIds = [...new Set(pending.map((row) => row.id))];
  const roles = [...new Set(pending.flatMap((row) => splitRoles(row.role)))];
  const byWorkspace = new Map<string, StoredRolePermission[]>();
  if (workspaceIds.length === 0 || roles.length === 0) return byWorkspace;

  const stored = await db
    .select({
      workspaceId: workspaceRoleTable.workspaceId,
      role: workspaceRoleTable.role,
      permission: workspaceRoleTable.permission,
    })
    .from(workspaceRoleTable)
    .where(
      and(
        inArray(workspaceRoleTable.workspaceId, workspaceIds),
        inArray(workspaceRoleTable.role, roles),
      ),
    );

  for (const { workspaceId, ...role } of stored) {
    const list = byWorkspace.get(workspaceId) ?? [];
    list.push(role);
    byWorkspace.set(workspaceId, list);
  }
  return byWorkspace;
}

export async function filterReadableWorkspaces<
  T extends WorkspaceAccess & { id: string },
>(rows: T[]): Promise<T[]> {
  const storedRoles = await loadStoredRoles(rows);
  return rows.filter((row) =>
    canReadWorkspace(row, storedRoles.get(row.id) ?? []),
  );
}
