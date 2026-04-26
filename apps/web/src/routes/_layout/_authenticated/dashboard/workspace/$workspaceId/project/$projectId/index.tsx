import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/",
)({
  beforeLoad: () => {
    throw redirect({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      replace: true,
    });
  },
});
