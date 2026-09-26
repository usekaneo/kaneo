import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { adminAccessQueryOptions } from "@/hooks/queries/admin/use-admin-access";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin",
)({
  beforeLoad: async ({ context }) => {
    const userId = context.session?.user.id;
    if (!userId) {
      if (context.sessionError) {
        return;
      }
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
