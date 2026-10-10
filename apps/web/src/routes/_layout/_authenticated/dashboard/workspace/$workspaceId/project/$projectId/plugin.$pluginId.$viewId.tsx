import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { PluginBoundary } from "@/components/plugins/plugin-boundary";
import { PluginPageStatus } from "@/components/plugins/plugin-page-status";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { usePlugins } from "@/lib/plugins/runtime/plugins-context";
import { findContribution } from "@/lib/plugins/runtime/select-contributions";
import { usePluginLabel } from "@/lib/plugins/runtime/use-plugin-label";
import { usePluginViewShortcuts } from "@/lib/plugins/runtime/use-plugin-view-shortcuts";

type PluginViewSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/plugin/$pluginId/$viewId",
)({
  component: RouteComponent,
  validateSearch: (
    search: Record<string, unknown>,
  ): PluginViewSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { workspaceId, projectId, pluginId, viewId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { plugins, isPending } = usePlugins();
  const label = usePluginLabel();
  const lookup = findContribution(
    plugins,
    "projectViews",
    pluginId,
    viewId,
    isPending,
  );

  const handleCloseTaskSheet = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  usePluginViewShortcuts(workspaceId, projectId);

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activePluginView={{ pluginId, viewId }}
    >
      {lookup.status === "ready" ? (
        <>
          <PageTitle title={label(pluginId, lookup.contribution.item.title)} />
          <div className="h-full min-h-0 overflow-auto">
            <PluginBoundary
              scope={lookup.contribution.scope}
              resetKey={`${workspaceId}:${projectId}:${viewId}`}
            >
              <lookup.contribution.item.component
                workspaceId={workspaceId}
                projectId={projectId}
              />
            </PluginBoundary>
          </div>
        </>
      ) : (
        <PluginPageStatus status={lookup.status} />
      )}

      <TaskDetailsSheet
        taskId={taskId}
        projectId={projectId}
        workspaceId={workspaceId}
        onClose={handleCloseTaskSheet}
      />
    </ProjectLayout>
  );
}
