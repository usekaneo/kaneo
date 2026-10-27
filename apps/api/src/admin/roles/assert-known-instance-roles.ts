import { isBuiltInInstanceRole } from "@kaneo/permissions";
import { APIError } from "better-auth/api";
import { inArray } from "drizzle-orm";
import db from "../../database";
import { instanceRoleTable } from "../../database/schema";

const ROLE_PATHS = new Set([
  "/admin/create-user",
  "/admin/set-role",
  "/admin/update-user",
]);

type RoleRequest = {
  path: string;
  body?: { role?: unknown; data?: { role?: unknown } } | null;
};

function requestedRole(ctx: RoleRequest) {
  if (ctx.path === "/admin/update-user") return ctx.body?.data?.role;
  return ctx.body?.role ?? ctx.body?.data?.role;
}

/**
 * better-auth's admin endpoints accept any role string. Only built-in roles
 * and existing custom roles may be stored, so a role created later can't
 * silently grant permissions to users who were given its name earlier.
 */
export async function assertKnownInstanceRoles(ctx: RoleRequest) {
  if (!ROLE_PATHS.has(ctx.path)) return;
  const role = requestedRole(ctx);
  if (role === undefined) return;
  const values = Array.isArray(role) ? role : [role];
  // Non-strings are left to better-auth's own validation.
  const names = values
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) => value.split(","))
    .filter((name) => !isBuiltInInstanceRole(name));
  if (names.length === 0) return;

  const existing = await db
    .select({ name: instanceRoleTable.name })
    .from(instanceRoleTable)
    .where(inArray(instanceRoleTable.name, names));
  const known = new Set(existing.map((row) => row.name));
  if (names.some((name) => !known.has(name))) {
    throw new APIError("BAD_REQUEST", {
      code: "UNKNOWN_ROLE",
      message: "This role does not exist.",
    });
  }
}
