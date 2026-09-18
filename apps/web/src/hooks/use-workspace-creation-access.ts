import { useEffect, useRef, useState } from "react";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import useGetConfig from "@/hooks/queries/config/use-get-config";

// "stale" is a refresh that failed: the cached role is all there is.
type RoleStatus = "pending" | "fresh" | "stale";

export type WorkspaceCreationAccess = {
  /** A confirmed non-admin under a confirmed `DISABLE_WORKSPACE_CREATION`. */
  isCreationRestricted: boolean;
  /** Both answers have settled, one way or another. */
  isDecided: boolean;
  /** Decided, and not restricted. */
  canCreateWorkspace: boolean;
};

/**
 * Whether to offer this user a workspace to create. The API is the authority —
 * it enforces `DISABLE_WORKSPACE_CREATION` through Better Auth's
 * `allowUserToCreateOrganization` — so this only decides what is worth
 * offering, and every screen that offers it has to agree.
 */
export default function useWorkspaceCreationAccess(): WorkspaceCreationAccess {
  const { user, refetchUser } = useAuth();
  const { data: config, isPending: configPending } = useGetConfig();

  // The session role can be up to five minutes stale: `auth.ts` notes that the
  // first-user bootstrap promotes to admin after the session is already
  // cached. Elsewhere a stale role only hides a button; here it decides
  // whether the first administrator of an instance is told to go and ask
  // someone for an invitation. Re-read it once, bypassing that cache.
  //
  // Guarded by a ref rather than the dependency array: the provider builds
  // `refetchUser` inline in its context value, so it is a new function on
  // every provider render, and refetching rerenders the provider. Depending on
  // it alone would refetch in a loop.
  const refreshStarted = useRef(false);
  const [roleStatus, setRoleStatus] = useState<RoleStatus>("pending");

  useEffect(() => {
    if (refreshStarted.current) return;
    refreshStarted.current = true;

    void (async () => {
      try {
        await refetchUser();
        setRoleStatus("fresh");
      } catch {
        // Swallowed rather than left to surface as an unhandled rejection.
        // The cached role still describes most users correctly; "stale" only
        // stops it being used to take something away.
        setRoleStatus("stale");
      }
    })();
  }, [refetchUser]);

  const isInstanceAdmin =
    (user as { role?: string | null } | null | undefined)?.role === "admin";

  // Only a confirmed non-admin under a confirmed restriction loses anything.
  // Every other combination — a role that could not be re-read, a config
  // request that failed — falls back to offering the form and leaves the API
  // with the final say, which it has either way. Guessing the other way would
  // strand a user on a screen with nothing on it.
  const isCreationRestricted =
    roleStatus === "fresh" &&
    !isInstanceAdmin &&
    !configPending &&
    config?.disableWorkspaceCreation === true;

  // An instance admin waits for the role refresh and nothing else: the setting
  // cannot restrict them, so the config's value cannot change their outcome
  // and waiting for it would only delay a form they are always entitled to.
  // Everyone else waits for both, rather than being shown a screen or a
  // control that the next render takes away.
  const isDecided =
    roleStatus !== "pending" && (isInstanceAdmin || !configPending);

  return {
    isCreationRestricted,
    isDecided,
    canCreateWorkspace: isDecided && !isCreationRestricted,
  };
}
