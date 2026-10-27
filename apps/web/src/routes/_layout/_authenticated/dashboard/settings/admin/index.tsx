import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/",
)({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/settings/admin/overview", replace: true });
  },
});
