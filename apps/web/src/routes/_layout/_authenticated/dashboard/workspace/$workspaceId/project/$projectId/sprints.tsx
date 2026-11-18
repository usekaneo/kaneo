import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import SprintsListView from "@/components/sprint-planning/sprints-list-view";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useProjectStore from "@/store/project";

type SprintsSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/sprints",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): SprintsSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();

  const handleCloseTaskSheet = useCallback(() => {
    navigate({
      to: ".",
      search: {},
      replace: true,
    });
  }, [navigate]);

  useEffect(() => {
    if (data) {
      setProject(data);
    }
  }, [data, setProject]);

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="sprints"
    >
      <PageTitle
        title={t("tasks:sprints.viewPageTitle", { name: project?.name })}
      />
      <div className="relative flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden bg-card h-full">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <SprintsListView projectId={projectId} />
          </div>
        </div>

        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={handleCloseTaskSheet}
        />
      </div>
    </ProjectLayout>
  );
}
