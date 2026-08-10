import * as Sentry from "@sentry/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    let session = null;
    try {
      const { data } = await authClient.getSession();
      session = data;
    } catch (error) {
      if (import.meta.env.DEV) console.warn("getSession failed", error);
      Sentry.captureException(error, { tags: { area: "auth.getSession" } });
      // getSession() rejected — treat as unauthenticated, allow auth pages to render
    }
    if (session) {
      throw redirect({
        to: "/dashboard",
      });
    }
    return { session };
  },
});
