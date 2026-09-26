import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { adminAccessQueryOptions } from "@/hooks/queries/admin/use-admin-access";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin",
)({
  beforeLoad: async ({ context }) => {
    const hasAccess = await context.queryClient.ensureQueryData(
      adminAccessQueryOptions,
    );

    if (!hasAccess) {
      throw redirect({ to: "/dashboard/settings/account/information" });
    }
  },
  component: Outlet,
});
