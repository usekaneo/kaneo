import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAdminAccess } from "@/fetchers/admin/get-admin-access";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin",
)({
  beforeLoad: async () => {
    if (!(await getAdminAccess())) {
      throw redirect({ to: "/dashboard/settings/account/information" });
    }
  },
  component: Outlet,
});
