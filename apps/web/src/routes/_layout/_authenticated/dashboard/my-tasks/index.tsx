import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/my-tasks/",
)({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/my-tasks/board", replace: true });
  },
});
