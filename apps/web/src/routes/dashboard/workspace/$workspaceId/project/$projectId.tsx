import ProjectLayout from "@/components/common/project-layout";
import EmptyProjectState from "@/components/project/empty-state";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/dashboard/workspace/$workspaceId/project/$projectId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, projectId } = Route.useParams();
  const { data: projects } = useGetProjects({ workspaceId });

  if (projects && projects.length === 0) {
    return <EmptyProjectState />;
  }

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      title="Project"
    >
      <Outlet />
    </ProjectLayout>
  );
}
