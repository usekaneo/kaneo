import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAdminPageRedirect } from "@/components/admin/admin-page-access";
import { adminAccessQueryOptions } from "@/hooks/queries/admin/use-admin-access";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin",
)({
  beforeLoad: async ({ context, location }) => {
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

    const permissions = await context.queryClient.ensureQueryData(
      adminAccessQueryOptions(userId),
    );

    const to = getAdminPageRedirect(location.pathname, permissions);
    if (to) {
      throw redirect({ to, replace: true });
    }
  },
  component: Outlet,
});
