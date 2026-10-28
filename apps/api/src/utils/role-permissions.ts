import { type BuiltInRoleName, builtInRoles } from "@kaneo/permissions";
import { missingPermissions } from "./missing-permissions";

export type PermissionMap = Record<string, string[]>;

type PermissionStatements = Record<string, readonly string[]>;

function builtInRoleStatements(role: string): PermissionStatements | null {
  if (role in builtInRoles) {
    return builtInRoles[role as BuiltInRoleName]
      .statements as PermissionStatements;
  }
  return null;
}

function parsePermissionStatements(raw: string): PermissionStatements | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  // Only keep entries shaped like { [resource: string]: string[] }.
  // Anything malformed is dropped so `satisfies()` never calls
  // `.includes()` on a non-array.
  const result: Record<string, string[]> = {};
  for (const [resource, actions] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (!Array.isArray(actions)) continue;
    const filtered = actions.filter(
      (action): action is string => typeof action === "string",
    );
    if (filtered.length > 0) {
      result[resource] = filtered;
    }
  }
  return result;
}

export function satisfies(
  statements: PermissionStatements,
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

function roleStatements(
  role: string,
  storedPermission: string | null | undefined,
): PermissionStatements | null {
  return (
    (storedPermission ? parsePermissionStatements(storedPermission) : null) ??
    builtInRoleStatements(role)
  );
}

export function roleAllows(
  role: string,
  storedPermission: string | null | undefined,
  permissions: PermissionMap,
) {
  const statements = roleStatements(role, storedPermission);
  return Boolean(statements && satisfies(statements, permissions));
}

export type StoredRolePermission = {
  role: string;
  permission: string | null;
};

function candidateStatements(
  roles: readonly string[],
  stored: readonly StoredRolePermission[],
) {
  return roles.flatMap((role) => {
    const rows = stored.filter((row) => row.role === role);
    if (rows.length === 0) return [roleStatements(role, null)];
    return rows.map((row) => roleStatements(role, row.permission));
  });
}

export function rolesAllow(
  roles: readonly string[],
  stored: readonly StoredRolePermission[],
  permissions: PermissionMap,
) {
  return candidateStatements(roles, stored).some((statements) =>
    Boolean(statements && satisfies(statements, permissions)),
  );
}

export function rolesMissingPermissions(
  roles: readonly string[],
  stored: readonly StoredRolePermission[],
  permissions: PermissionMap,
): string[] {
  let closest = missingPermissions(null, permissions);
  for (const statements of candidateStatements(roles, stored)) {
    const missing = missingPermissions(statements, permissions);
    if (missing.length < closest.length) closest = missing;
  }
  return closest;
}
