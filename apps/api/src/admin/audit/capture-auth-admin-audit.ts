import { getSessionFromCtx } from "better-auth/api";
import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { readClientIp } from "../../utils/client-ip";
import type { AdminAuditRequest } from "./admin-audit-request";
import type { AuditUserSnapshot } from "./audit-user-snapshot";

type AuthContext = Parameters<typeof getSessionFromCtx>[0];

/** better-auth admin endpoints that change something worth auditing. */
export const AUDITED_AUTH_ADMIN_PATHS = new Set([
  "/admin/create-user",
  "/admin/update-user",
  "/admin/set-role",
  "/admin/ban-user",
  "/admin/unban-user",
  "/admin/remove-user",
  "/admin/set-user-password",
  "/admin/impersonate-user",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
]);

export type AuthAdminAuditCapture = {
  request: AdminAuditRequest;
  target?: AuditUserSnapshot;
  sessionId?: string;
};

// better-auth shares `ctx.context` between the before and after hooks.
type CaptureContext = AuthContext["context"] & {
  kaneoAdminAudit?: AuthAdminAuditCapture;
};

const userColumns = {
  id: schema.userTable.id,
  name: schema.userTable.name,
  email: schema.userTable.email,
  role: schema.userTable.role,
  banned: schema.userTable.banned,
  emailVerified: schema.userTable.emailVerified,
  image: schema.userTable.image,
};

async function findUser(userId: unknown) {
  if (typeof userId !== "string" || userId === "") return undefined;
  const [user] = await db
    .select(userColumns)
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);
  return user;
}

async function findSessionOwner(token: unknown) {
  if (typeof token !== "string" || token === "") return undefined;
  const [session] = await db
    .select({ id: schema.sessionTable.id, userId: schema.sessionTable.userId })
    .from(schema.sessionTable)
    .where(eq(schema.sessionTable.token, token))
    .limit(1);
  return session;
}

/**
 * Before an audited admin endpoint runs, remember who is calling and what the
 * target looked like: deletions and updates change it before the after hook.
 * Calls without a session (server-side `auth.api.*` use) are not recorded here.
 */
export async function captureAuthAdminAudit(ctx: AuthContext) {
  if (!AUDITED_AUTH_ADMIN_PATHS.has(ctx.path)) return;
  const session = await getSessionFromCtx(ctx, {
    disableCookieCache: true,
    disableRefresh: true,
  });
  if (!session) return;

  const body = ctx.body as Record<string, unknown> | undefined;
  const revoked =
    ctx.path === "/admin/revoke-user-session"
      ? await findSessionOwner(body?.sessionToken)
      : undefined;
  const target = await findUser(revoked ? revoked.userId : body?.userId);

  (ctx.context as CaptureContext).kaneoAdminAudit = {
    request: {
      actorUserId: session.user.id,
      ipAddress: readClientIp(ctx.headers),
      userAgent: ctx.headers?.get("user-agent") ?? null,
    },
    target,
    sessionId: revoked?.id,
  };
}

export function takeAuthAdminAuditCapture(ctx: AuthContext) {
  const context = ctx.context as CaptureContext;
  const capture = context.kaneoAdminAudit;
  context.kaneoAdminAudit = undefined;
  return capture;
}
