import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceTasks } from "@/components/workspace-tasks/workspace-tasks";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/tasks",
)({ component: RouteComponent });
function RouteComponent() {
  const { workspaceId } = Route.useParams();
  return <WorkspaceTasks key={workspaceId} workspaceId={workspaceId} />;
}
