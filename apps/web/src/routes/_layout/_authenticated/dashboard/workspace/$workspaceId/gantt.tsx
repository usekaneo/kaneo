import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/gantt",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/workspace/$workspaceId/calendar",
      params: { workspaceId: params.workspaceId },
    });
  },
});
