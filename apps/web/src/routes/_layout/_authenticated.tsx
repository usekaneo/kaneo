import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTrackSignup } from "@/hooks/use-track-signup";
import { useUserWebSocket } from "@/hooks/use-user-websocket";
import { authClient } from "@/lib/auth-client";

// protects all child routes, must be logged in
export const Route = createFileRoute("/_layout/_authenticated")({
  component: AuthenticatedLayout,
  beforeLoad: async ({ location }) => {
    let session = null;
    let sessionError = false;
    try {
      // better-auth reports failures (429, 5xx, network) in `error` rather
      // than throwing; a missing session is `data: null` with no error.
      const { data, error } = await authClient.getSession();
      session = data;
      if (error) {
        sessionError = true;
        if (import.meta.env.DEV) console.warn("getSession failed", error);
      }
    } catch (error) {
      sessionError = true;
      if (import.meta.env.DEV) console.warn("getSession failed", error);
      // getSession() rejected (e.g. network error) — session state is
      // unknown. Don't conflate with "no session" (unauthenticated): let
      // children decide whether to skip active-organization mutations.
    }
    if (!session && !sessionError) {
      throw redirect({
        to: "/auth/sign-in",
        search: {
          // location.href is pathname + search + hash without the origin.
          // location.search is a null-prototype parsed object, so string
          // concatenation on it throws "Cannot convert object to primitive value".
          redirect: location.href,
        },
      });
    }
    return { session, sessionError };
  },
});

function AuthenticatedLayout() {
  const { session } = Route.useRouteContext();
  useUserWebSocket();
  useTrackSignup(session?.user);
  return <Outlet />;
}
