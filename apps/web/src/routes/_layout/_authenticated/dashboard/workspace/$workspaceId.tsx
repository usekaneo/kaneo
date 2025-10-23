import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();

  const { data: activeWorkspace } = useActiveWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    // If we have an active workspace and it doesn't match the URL, redirect to the correct workspace
    if (activeWorkspace && activeWorkspace.id !== workspaceId) {
      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: activeWorkspace.id },
        replace: true, // Replace current history entry to avoid back button issues
      });
    }
  }, [activeWorkspace, workspaceId, navigate]);

  // Don't render anything if we're redirecting
  if (activeWorkspace && activeWorkspace.id !== workspaceId) {
    return null;
  }

  return <Outlet />;
}
