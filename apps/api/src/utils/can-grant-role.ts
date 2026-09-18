import { coversPermissions } from "@kaneo/permissions";
import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import {
  getMemberRole,
  getRoleStatements,
} from "./require-workspace-permission";

type Statements = Record<string, readonly string[]>;

function parseRoles(role: unknown): string[] {
  const raw = Array.isArray(role) ? role.join(",") : String(role ?? "");
  return raw
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

async function statementsForRoles(workspaceId: string, roles: string[]) {
  const resolved = await Promise.all(
    roles.map((role) => getRoleStatements(workspaceId, role)),
  );
  // Unknown roles are left to Better Auth, which rejects them with
  // ROLE_NOT_FOUND; failing here would hide that clearer error.
  return resolved.filter((s): s is Statements => s !== null);
}

// Better Auth only stops non-owners from granting the owner role. Anyone
// holding invitation:create or member:update could otherwise hand out a role
// stronger than their own.
export async function canGrantRole({
  workspaceId,
  userId,
  role,
  isInstanceAdmin,
}: {
  workspaceId: string;
  userId: string;
  role: unknown;
  isInstanceAdmin: boolean;
}): Promise<boolean> {
  if (isInstanceAdmin) return true;

  const granterRoles = parseRoles(await getMemberRole(workspaceId, userId));
  if (granterRoles.length === 0) return false;
  if (granterRoles.includes("owner")) return true;

  const targetRoles = parseRoles(role);
  if (targetRoles.includes("owner")) return false;

  return coversPermissions(
    await statementsForRoles(workspaceId, granterRoles),
    await statementsForRoles(workspaceId, targetRoles),
  );
}

export async function getRoleOfMembership(
  workspaceId: string,
  memberId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.id, memberId),
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  return row?.role ?? null;
}
