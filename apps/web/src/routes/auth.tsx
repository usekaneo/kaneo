import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth")({
  beforeLoad: async ({ location }) => {
    let session = null;
    try {
      const { data } = await authClient.getSession();
      session = data;
    } catch (error) {
      if (import.meta.env.DEV) console.warn("getSession failed", error);
      // getSession() rejected (e.g. network error) — treat as unauthenticated, allow auth pages to render
    }
    const isPasswordRecovery = [
      "/auth/forgot-password",
      "/auth/reset-password",
    ].includes(location.pathname.replace(/\/$/, ""));
    if (session && !isPasswordRecovery) {
      throw redirect({
        to: "/dashboard",
      });
    }
    return { session };
  },
});
