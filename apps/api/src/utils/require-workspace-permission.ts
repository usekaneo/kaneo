import { type BuiltInRoleName, builtInRoles } from "@kaneo/permissions";
import { and, eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { isInstanceAdmin } from "./is-instance-admin";

type PermissionMap = Record<string, string[]>;

function builtInRoleStatements(
  role: string,
): Record<string, readonly string[]> | null {
  if (role in builtInRoles) {
    return builtInRoles[role as BuiltInRoleName].statements as Record<
      string,
      readonly string[]
    >;
  }
  return null;
}

async function customRoleStatements(
  workspaceId: string,
  role: string,
): Promise<Record<string, readonly string[]> | null> {
  const [row] = await db
    .select({ permission: schema.workspaceRoleTable.permission })
    .from(schema.workspaceRoleTable)
    .where(
      and(
        eq(schema.workspaceRoleTable.workspaceId, workspaceId),
        eq(schema.workspaceRoleTable.role, role),
      ),
    )
    .limit(1);

  if (!row?.permission) return null;

  try {
    const parsed = JSON.parse(row.permission) as Record<string, string[]>;
    return parsed;
  } catch {
    return null;
  }
}

function satisfies(
  statements: Record<string, readonly string[]>,
  required: PermissionMap,
): boolean {
  for (const [resource, actions] of Object.entries(required)) {
    const granted = statements[resource];
    if (!granted) return false;
    for (const action of actions) {
      if (!granted.includes(action)) return false;
    }
  }
  return true;
}

export function requireWorkspacePermission(permissions: PermissionMap) {
  return async (c: Context, next: Next) => {
    const workspaceId = c.get("workspaceId");
    if (!workspaceId) {
      throw new HTTPException(500, {
        message: "workspaceId not set in context",
      });
    }

    if (await isInstanceAdmin(c)) {
      return next();
    }

    const userId = c.get("userId");
    if (!userId) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

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

    if (!member?.role) {
      throw new HTTPException(403, { message: "Insufficient permissions" });
    }

    const statements =
      builtInRoleStatements(member.role) ??
      (await customRoleStatements(workspaceId, member.role));

    if (!statements || !satisfies(statements, permissions)) {
      throw new HTTPException(403, { message: "Insufficient permissions" });
    }

    return next();
  };
}
