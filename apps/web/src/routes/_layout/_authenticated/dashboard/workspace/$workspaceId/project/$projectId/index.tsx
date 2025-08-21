import ProjectLayout from "@/components/common/project-layout";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, projectId } = Route.useParams();

  return (
    <ProjectLayout
      title="Project"
      projectId={projectId}
      workspaceId={workspaceId}
    >
      <Outlet />
    </ProjectLayout>
  );
}
