import type { Context, Next } from "hono";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import type { PermissionMap } from "../utils/role-permissions";

export function requireSearchPermission(c: Context, next: Next) {
  // Route middleware runs before query validation.
  const type = c.req.query("type") ?? "all";
  let permissions: PermissionMap;
  switch (type) {
    case "projects":
      permissions = { project: ["read"] };
      break;
    case "workspaces":
      permissions = { workspace: ["read"] };
      break;
    case "tasks":
    case "comments":
    case "activities":
      permissions = { project: ["read"], task: ["read"] };
      break;
    default:
      permissions = {
        project: ["read"],
        task: ["read"],
        workspace: ["read"],
      };
  }
  return requireWorkspacePermission(permissions)(c, next);
}
