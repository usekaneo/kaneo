import { createFileRoute, redirect } from "@tanstack/react-router";

// Members grew into People; keep old links and bookmarks working.
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/members",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/workspace/$workspaceId/people",
      params: { workspaceId: params.workspaceId },
      replace: true,
    });
  },
});
