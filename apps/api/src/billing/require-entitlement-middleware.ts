import type { Context, Next } from "hono";
import { requireWorkspaceEntitlement } from "./controllers/require-entitlement";

/**
 * Blocks the request when the workspace has no active Kaneo Cloud entitlement
 * (expired trial, canceled or expired subscription). Must run after a
 * workspace-access middleware that sets `c.get("workspaceId")`. No-ops when
 * billing is disabled, so self-hosted installs are unaffected.
 */
export async function requireEntitlement(c: Context, next: Next) {
  const workspaceId = c.get("workspaceId");
  if (workspaceId) {
    await requireWorkspaceEntitlement(workspaceId);
  }
  return next();
}
