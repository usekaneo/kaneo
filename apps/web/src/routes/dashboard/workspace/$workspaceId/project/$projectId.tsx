import ProjectLayout from "@/components/common/project-layout";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/dashboard/workspace/$workspaceId/project/$projectId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, projectId } = Route.useParams();
  const { viewMode } = useUserPreferencesStore();

  const location = useLocation();
  const isSettingsPage = location.pathname.includes("/settings");

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      title={
        isSettingsPage
          ? "Project Settings"
          : viewMode === "board"
            ? "Board"
            : "List"
      }
    >
      <Outlet />
    </ProjectLayout>
  );
}
