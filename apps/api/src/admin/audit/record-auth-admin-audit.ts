import { type getSessionFromCtx, isAPIError } from "better-auth/api";
import { takeAuthAdminAuditCapture } from "./capture-auth-admin-audit";
import { describeAuthAdminAction } from "./describe-auth-admin-action";
import { recordAdminAction } from "./record-admin-action";

type AuthContext = Parameters<typeof getSessionFromCtx>[0];

/** After an audited admin endpoint, record it if it succeeded. */
export async function recordAuthAdminAudit(ctx: AuthContext) {
  const capture = takeAuthAdminAuditCapture(ctx);
  const returned = ctx.context.returned;
  if (!capture || returned === undefined || isAPIError(returned)) return;

  const entries = describeAuthAdminAction({
    path: ctx.path,
    body: ctx.body as Record<string, unknown> | undefined,
    target: capture.target,
    sessionId: capture.sessionId,
    returned,
  });
  try {
    for (const entry of entries) {
      await recordAdminAction({ ...capture.request, ...entry });
    }
  } catch (error) {
    // The change already committed; failing the response would not undo it.
    console.error("Admin audit entry could not be recorded:", {
      action: entries[0]?.action,
      error: error instanceof Error ? error.name : typeof error,
    });
  }
}
