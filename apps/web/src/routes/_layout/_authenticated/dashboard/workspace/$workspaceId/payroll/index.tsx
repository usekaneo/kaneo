import { createFileRoute, redirect } from "@tanstack/react-router";

// Payroll lives on the Expenses page now; keep old links working.
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/payroll/",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/workspace/$workspaceId/expenses",
      params: { workspaceId: params.workspaceId },
      search: { tab: "payroll" },
      replace: true,
    });
  },
});
