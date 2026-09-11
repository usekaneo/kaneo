import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

// protects all child routes, must be logged in
export const Route = createFileRoute("/_layout/_authenticated")({
  beforeLoad: async ({ location }) => {
    let session = null;
    let sessionError = false;
    try {
      const { data } = await authClient.getSession();
      session = data;
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
