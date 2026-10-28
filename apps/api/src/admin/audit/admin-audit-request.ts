import type { Context } from "hono";
import { readClientIp } from "../../utils/client-ip";

/** Who performed an admin action, and from where. */
export type AdminAuditRequest = {
  actorUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export function adminAuditRequest(c: Context): AdminAuditRequest {
  return {
    actorUserId: c.get("user")?.id ?? null,
    ipAddress: readClientIp(c.req.raw.headers),
    userAgent: c.req.header("user-agent") ?? null,
  };
}
