import { createAuthEndpoint, revokeOtherSessions } from "better-auth/api";
import { revokeOtherUserSessions } from "../database/auth-adapter";

export const lockedSessionRevocation = {
  id: "locked-session-revocation",
  endpoints: {
    // Override by the provider's endpoint key so HTTP and auth.api share the
    // same sensitive-session middleware, metadata and response contract.
    revokeOtherSessions: createAuthEndpoint(
      "/revoke-other-sessions",
      revokeOtherSessions.options,
      async (ctx) => {
        const { user, session } = ctx.context.session;
        await revokeOtherUserSessions(
          ctx.context.adapter,
          user.id,
          session.token,
          (tokens) => ctx.context.internalAdapter.deleteSessions(tokens),
        );
        return ctx.json({ status: true });
      },
    ),
  },
};
