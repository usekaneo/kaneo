import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { adminAccessQueryOptions } from "@/hooks/queries/admin/use-admin-access";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin",
)({
  beforeLoad: async ({ context }) => {
    let userId = context.session?.user.id;
    if (!userId && context.sessionError) {
      const { data } = await authClient.getSession();
      userId = data?.user.id;
      if (!userId) {
        throw redirect({ to: "/auth/sign-in" });
      }
    }
    if (!userId) {
      throw redirect({ to: "/dashboard/settings/account/information" });
    }

    const hasAccess = await context.queryClient.ensureQueryData(
      adminAccessQueryOptions(userId),
    );

    if (!hasAccess) {
      throw redirect({ to: "/dashboard/settings/account/information" });
    }
  },
  component: Outlet,
});
