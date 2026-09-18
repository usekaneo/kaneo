import { statement } from "@kaneo/permissions";
import type { Context } from "hono";
import { isInstanceAdmin } from "../../utils/is-instance-admin";
import {
  getMemberRole,
  getRoleStatements,
} from "../../utils/require-workspace-permission";

type Statements = Record<string, string[]>;

function merge(all: Record<string, readonly string[]>[]): Statements {
  const out: Record<string, Set<string>> = {};
  for (const statements of all) {
    for (const [resource, actions] of Object.entries(statements)) {
      out[resource] ??= new Set();
      for (const action of actions) out[resource].add(action);
    }
  }
  return Object.fromEntries(
    Object.entries(out).map(([resource, actions]) => [resource, [...actions]]),
  );
}

function intersect(a: Statements, b: Record<string, string[]>): Statements {
  const out: Statements = {};
  for (const [resource, actions] of Object.entries(a)) {
    const kept = actions.filter((action) => b[resource]?.includes(action));
    if (kept.length > 0) out[resource] = kept;
  }
  return out;
}

// What the caller may do in a workspace, resolved the same way
// hasWorkspacePermission resolves it, so the UI can hide what the API would
// refuse with one request instead of one per capability. The API still
// checks every call.
async function getMyPermissions(c: Context, workspaceId: string) {
  let resolved: Statements;

  if (await isInstanceAdmin(c)) {
    resolved = merge([statement]);
  } else {
    const roles = ((await getMemberRole(workspaceId, c.get("userId"))) ?? "")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    const statements = await Promise.all(
      roles.map((role) => getRoleStatements(workspaceId, role)),
    );
    resolved = merge(
      statements.filter(
        (s): s is Record<string, readonly string[]> => s !== null,
      ),
    );
  }

  const apiKey = c.get("apiKey") as
    | { permissions?: Record<string, string[]> | null }
    | undefined;
  return apiKey?.permissions
    ? intersect(resolved, apiKey.permissions)
    : resolved;
}

export default getMyPermissions;
