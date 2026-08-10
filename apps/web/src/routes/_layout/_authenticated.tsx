import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

// protects all child routes, must be logged in
export const Route = createFileRoute("/_layout/_authenticated")({
  beforeLoad: async ({ location }) => {
    let session = null;
    try {
      const { data } = await authClient.getSession();
      session = data;
    } catch {
      // getSession() rejected (e.g. network error) — treat as unauthenticated
    }
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
        search: {
          redirect: location.pathname,
        },
      });
    }
    return { session };
  },
});
