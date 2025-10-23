import { createFileRoute, Outlet } from "@tanstack/react-router";
import ProjectLayout from "@/components/common/project-layout";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, projectId } = Route.useParams();

  return (
    <ProjectLayout projectId={projectId} workspaceId={workspaceId}>
      <Outlet />
    </ProjectLayout>
  );
}
