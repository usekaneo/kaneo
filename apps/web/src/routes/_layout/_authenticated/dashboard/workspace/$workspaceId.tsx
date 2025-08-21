import { authClient } from "@/lib/auth-client";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId",
)({
  beforeLoad: async ({ params }) => {
    const { workspaceId } = params;

    // URL is source of truth for active workspace
    await authClient.organization.setActive({
      organizationId: workspaceId,
    });
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
