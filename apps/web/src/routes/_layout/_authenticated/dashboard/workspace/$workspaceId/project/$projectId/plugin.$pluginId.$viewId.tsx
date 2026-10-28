import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { PluginBoundary } from "@/components/plugins/plugin-boundary";
import { PluginLayoutDisplay } from "@/components/plugins/plugin-layout-display";
import { PluginPageStatus } from "@/components/plugins/plugin-page-status";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { TaskCount } from "@/components/project/toolbar/task-count";
import { useProjectTaskView } from "@/components/project/toolbar/use-project-task-view";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import useGetProject from "@/hooks/queries/project/use-get-project";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { countLayoutTasks } from "@/lib/plugins/host/count-layout-tasks";
import { PluginProjectViewContext } from "@/lib/plugins/host/plugin-project-view-context";
import { usePluginLayoutTasks } from "@/lib/plugins/host/use-plugin-layout-tasks";
import { pluginLayoutId } from "@/lib/plugins/plugin-layout-id";
import { usePlugins } from "@/lib/plugins/runtime/plugins-context";
import { pluginsForWorkspace } from "@/lib/plugins/runtime/plugins-for-workspace";
import { findContribution } from "@/lib/plugins/runtime/select-contributions";
import { usePluginLabel } from "@/lib/plugins/runtime/use-plugin-label";

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
  const { data: projectInfo, isPending: isProjectPending } = useGetProject({
    id: projectId,
    workspaceId,
  });
  const label = usePluginLabel();
  const lookup = findContribution(
    pluginsForWorkspace(plugins, workspaceId, projectInfo?.workspaceId),
    "projectViews",
    pluginId,
    viewId,
    isPending || isProjectPending,
  );
  const contribution = lookup.status === "ready" ? lookup.contribution : null;
  const scope = contribution?.item.scope ?? "board";
  const layoutId = pluginLayoutId({ pluginId, viewId });
  const { data: project, isLoading, error } = useGetTasks(projectId);
  const view = useProjectTaskView({ project, projectId, workspaceId, scope });
  const state = usePluginLayoutTasks({
    project,
    filteredProject: view.filters.filteredProject,
    scope,
    isLoading,
    error,
  });
  const countsTask = contribution?.item.countsTask;

  const handleCloseTaskSheet = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView={layoutId}
      toolbar={
        <ProjectToolbar
          view={view}
          display={
            <PluginLayoutDisplay
              workspaceId={workspaceId}
              projectId={projectId}
              layoutId={layoutId}
              contribution={contribution}
              state={state}
            />
          }
        />
      }
      summary={
        <TaskCount
          shown={countLayoutTasks(state.tasks, countsTask)}
          total={countLayoutTasks(state.allTasks, countsTask)}
        />
      }
      filterBar={
        <ActiveFiltersBar
          subjects={view.subjects}
          onClear={view.filters.clearFilters}
          customFieldValues={view.filters.customFieldValues}
        />
      }
    >
      {lookup.status === "ready" ? (
        <>
          <PageTitle title={label(pluginId, lookup.contribution.item.title)} />
          <div className="h-full min-h-0 overflow-auto">
            <PluginBoundary
              scope={lookup.contribution.scope}
              resetKey={`${workspaceId}:${projectId}:${viewId}`}
            >
              <PluginProjectViewContext.Provider value={state}>
                <lookup.contribution.item.component
                  workspaceId={workspaceId}
                  projectId={projectId}
                />
              </PluginProjectViewContext.Provider>
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
