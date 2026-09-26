import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { adminAccessQueryOptions } from "@/hooks/queries/admin/use-admin-access";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin",
)({
  beforeLoad: async ({ context }) => {
    const userId = context.session?.user.id;
    const hasAccess = userId
      ? await context.queryClient.ensureQueryData(
          adminAccessQueryOptions(userId),
        )
      : false;

    if (!hasAccess) {
      throw redirect({ to: "/dashboard/settings/account/information" });
    }
  },
  component: Outlet,
});
