import { createFileRoute, Outlet } from "@tanstack/react-router";
import WorkspaceArchived from "@/components/common/workspace-archived";
import useWorkspaceArchived from "@/hooks/queries/workspace/use-workspace-archived";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const isArchived = useWorkspaceArchived(workspaceId);

  return isArchived ? <WorkspaceArchived /> : <Outlet />;
}
