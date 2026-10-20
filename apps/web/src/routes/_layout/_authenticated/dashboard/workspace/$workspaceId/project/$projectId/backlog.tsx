import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { produce } from "immer";
import { SquareKanbanIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BacklogListView from "@/components/backlog-list-view";
import { BacklogToolbarActions } from "@/components/backlog-list-view/backlog-toolbar-actions";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { TaskDisplayOptions } from "@/components/project/display/task-display-options";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { TaskCount } from "@/components/project/toolbar/task-count";
import { useProjectTaskView } from "@/components/project/toolbar/use-project-task-view";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useBoardSort } from "@/hooks/use-board-sort";
import { sortTasks } from "@/lib/sort-tasks";
import { countBacklogTasks } from "@/lib/task-filters/count-tasks";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";

type BacklogSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/backlog",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BacklogSearchParams => ({
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
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isMoveAllOpen, setIsMoveAllOpen] = useState(false);
  const [moveAllCount, setMoveAllCount] = useState(0);
  const { mutate: updateTask } = useUpdateTask();
  const { sort, setSort } = useBoardSort(projectId, "backlog");
  const view = useProjectTaskView({
    project,
    projectId,
    workspaceId,
    scope: "backlog",
  });
  const { filters } = view;

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

  const sortedProject = useMemo(() => {
    const filteredProject = filters.filteredProject;
    if (!filteredProject || sort.field === "position") return filteredProject;
    return {
      ...filteredProject,
      plannedTasks: sortTasks(filteredProject.plannedTasks || [], sort),
      archivedTasks: sortTasks(filteredProject.archivedTasks || [], sort),
    };
  }, [filters.filteredProject, sort]);

  const handleMoveAllPlannedToTodo = () => {
    if (!project) return;

    const plannedTasks = project.plannedTasks || [];

    if (plannedTasks.length === 0) {
      toast.info(t("tasks:backlog.noTasksToMove"));
      return;
    }

    setMoveAllCount(plannedTasks.length);
    setIsMoveAllOpen(true);
  };

  const confirmMoveAllPlannedToTodo = () => {
    setIsMoveAllOpen(false);
    if (!project) return;

    const plannedTasks = project.plannedTasks || [];

    for (const task of plannedTasks) {
      updateTask({
        ...task,
        status: "to-do",
      });
    }

    const updatedProject = produce(project, (draft) => {
      // "to-do" is a column slug, so it can only be matched against slug.
      const todoColumn = draft.columns?.find((col) => col.slug === "to-do");
      if (todoColumn && draft.plannedTasks) {
        todoColumn.tasks.push(
          ...draft.plannedTasks.map((task) => ({
            ...task,
            status: "to-do",
          })),
        );

        draft.plannedTasks = [];
      }
    });

    setProject(updatedProject);
    toast.success(
      t("tasks:backlog.moveAllSuccess", { count: plannedTasks.length }),
      { icon: SquareKanbanIcon },
    );
  };

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="backlog"
      toolbar={
        <ProjectToolbar
          view={view}
          actions={
            <BacklogToolbarActions
              onPlan={() => setIsTaskModalOpen(true)}
              onMoveAll={handleMoveAllPlannedToTodo}
            />
          }
          display={
            <TaskDisplayOptions
              projectId={projectId}
              sort={sort}
              onSortChange={setSort}
              layout="rows"
            />
          }
        />
      }
      summary={
        <TaskCount
          shown={countBacklogTasks(filters.filteredProject)}
          total={countBacklogTasks(project)}
        />
      }
      filterBar={
        <ActiveFiltersBar
          subjects={view.subjects}
          onClear={filters.clearFilters}
        />
      }
    >
      <PageTitle
        title={t("tasks:backlog.pageTitle", { name: project?.name })}
      />
      <div className="relative flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex-1 overflow-hidden bg-card h-full">
          {sortedProject ? (
            <BacklogListView
              project={sortedProject}
              disableDragDrop={sort.field !== "position"}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-muted rounded-lg animate-pulse mx-auto" />
                <div className="space-y-2">
                  <div className="w-48 h-4 bg-muted rounded animate-pulse mx-auto" />
                  <div className="w-64 h-3 bg-muted rounded animate-pulse mx-auto" />
                </div>
              </div>
            </div>
          )}
        </div>

        <CreateTaskModal
          open={isTaskModalOpen}
          projectId={projectId}
          onClose={() => setIsTaskModalOpen(false)}
          status="planned"
        />

        <ConfirmDialog
          open={isMoveAllOpen}
          onOpenChange={setIsMoveAllOpen}
          title={t("tasks:backlog.moveAllConfirm", { count: moveAllCount })}
          confirmLabel={t("tasks:backlog.moveAll")}
          destructive={false}
          onConfirm={confirmMoveAllPlannedToTodo}
        />

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
