import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { hasWorkspacePermission } from "./require-workspace-permission";

// Company data about a person (attendance, activity, requests, pay) is always
// visible to that person; anyone else needs the given permission.
export async function assertSelfOrPermission(
  c: Context,
  userId: string,
  permissions: Record<string, string[]>,
) {
  if (userId === c.get("userId")) return;
  if (await hasWorkspacePermission(c, permissions)) return;
  throw new HTTPException(403, {
    message: "You can only see your own information",
  });
}

export async function assertPermission(
  c: Context,
  permissions: Record<string, string[]>,
) {
  if (await hasWorkspacePermission(c, permissions)) return;
  throw new HTTPException(403, { message: "Insufficient permissions" });
}
