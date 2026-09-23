import * as Sentry from "@sentry/react";
import {
  createContext,
  type PropsWithChildren,
  useEffect,
  useRef,
} from "react";
import { authClient } from "@/lib/auth-client";
import type { User } from "@/types/user";
import { LoadingSkeleton } from "../../ui/loading-skeleton";

const { useSession } = authClient;

export const AuthContext = createContext<{
  user: User | null | undefined;
  isLoading: boolean;
  refetchUser: () => Promise<void>;
}>({
  user: undefined,
  isLoading: true,
  refetchUser: async () => {},
});

function AuthProvider({ children }: PropsWithChildren) {
  const { data, isPending, refetch, error } = useSession();
  // Only show the loading skeleton during the *first* session fetch. Better
  // Auth re-fetches the session on window focus; if we kept returning the
  // skeleton while those background fetches are pending we'd unmount the
  // entire route tree on every alt-tab, which tore down the Turnstile
  // iframe and forced a re-challenge.
  const hasLoadedOnce = useRef(false);
  if (!isPending) {
    hasLoadedOnce.current = true;
  }

  // Tag transient Safari "Load failed" errors during the session fetch so
  // instrument.ts's beforeSend can drop them. Better Auth's useSession
  // uses nanostores rather than TanStack Query, so the query client's
  // network-error cooldown doesn't reach this path. Real auth failures
  // (e.g. 401) still surface to Sentry through Better Auth.
  useEffect(() => {
    if (error instanceof Error && error.message.includes("Load failed")) {
      Sentry.captureException(error, { tags: { area: "auth.session" } });
    }
  }, [error]);

  if (isPending && !hasLoadedOnce.current) {
    return <LoadingSkeleton />;
  }

  return (
    <AuthContext.Provider
      value={{
        user: (data?.user as User | null | undefined) ?? null,
        isLoading: isPending,
        refetchUser: async () => {
          await refetch({ query: { disableCookieCache: true } });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
