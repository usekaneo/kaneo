import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import KanbanBoard from "@/components/kanban-board";
import BoardSkeleton from "@/components/kanban-board/board-skeleton";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { findBoardTask } from "@/lib/board-task";
import { TaskCount } from "@/components/project/toolbar/task-count";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import AssigneeQuickFilter from "@/components/workspace-tasks/assignee-quick-filter";
import ShowCompletedToggle from "@/components/workspace-tasks/show-completed-toggle";
import {
  quickFilterSelection,
  toggleQuickFilterAssignee,
} from "@/components/workspace-tasks/quick-filter-selection";
import { useWorkspaceTaskMove } from "@/components/workspace-tasks/use-workspace-task-move";
import { useWorkspaceTaskView } from "@/components/workspace-tasks/use-workspace-task-view";
import { WorkspaceDisplayOptions } from "@/components/workspace-tasks/workspace-display-options";
import WorkspaceTasksEmpty from "@/components/workspace-tasks/workspace-tasks-empty";
import WorkspaceTasksError from "@/components/workspace-tasks/workspace-tasks-error";
import { WORKSPACE_BOARD_ID_PREFIX } from "@/fetchers/task/get-workspace-board";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useBoardSort } from "@/hooks/use-board-sort";
import { sortTasks } from "@/lib/sort-tasks";
import { countColumnTasks } from "@/lib/task-filters/count-tasks";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";

type TasksSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/tasks",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): TasksSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setProject } = useProjectStore();
  const viewMode = useUserPreferencesStore((state) => state.viewMode);
  const { sort, setSort } = useBoardSort(`workspace:${workspaceId}`);
  const view = useWorkspaceTaskView(workspaceId);
  const { board, filteredBoard, filters, isError, refetch } = view;
  // Deep links and tasks filtered off the board still need their project.
  const { data: openTask } = useGetTask(taskId ?? "");

  // Cards, context menus and shortcuts read the current board from the store.
  useEffect(() => {
    if (board) setProject(board);
  }, [board, setProject]);

  // The merged board is synthetic; a project page must not inherit it.
  useEffect(
    () => () => {
      const { project, setProject: reset } = useProjectStore.getState();
      if (project?.id.startsWith(WORKSPACE_BOARD_ID_PREFIX)) reset(undefined);
    },
    [],
  );

  const sortedBoard = useMemo(() => {
    if (!filteredBoard || sort.field === "position") return filteredBoard;
    return {
      ...filteredBoard,
      columns: filteredBoard.columns.map((column) => ({
        ...column,
        tasks: sortTasks(column.tasks, sort),
      })),
    };
  }, [filteredBoard, sort]);

  const handleCloseTaskSheet = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  const selectedTask = useMemo(
    () => (taskId ? findBoardTask(board, taskId) : undefined),
    [board, taskId],
  );

  const handleTaskStatusChange = useWorkspaceTaskMove(
    workspaceId,
    view.serverQuery,
    board,
  );

  const loadedTaskCount = countColumnTasks(board);
  const visibleTaskCount = countColumnTasks(sortedBoard);
  const isInitialLoad = !sortedBoard && !isError;
  const isFiltered = filters.hasActiveFilters || view.search.trim().length > 0;
  // Drops only change the column; within a column the chosen sort, or the
  // server order by due date, stands.
  const automaticSort = sort.field === "position" ? "dueDate" : sort.field;

  return (
    <>
      <PageTitle
        title={`${t("workspace:tasks.pageTitle")} / ${
          viewMode === "board" ? t("tasks:view.board") : t("tasks:view.list")
        }`}
      />
      <WorkspaceLayout
        title={t("workspace:tasks.pageTitle")}
        summary={
          <>
            <AssigneeQuickFilter
              members={view.members}
              selected={quickFilterSelection(filters.filters)}
              onToggle={(userId) =>
                filters.setFilters((current) =>
                  toggleQuickFilterAssignee(current, userId),
                )
              }
              currentUserId={user?.id}
            />
            {board && (
              <TaskCount shown={visibleTaskCount} total={board.total} />
            )}
          </>
        }
        toolbar={
          <ProjectToolbar
            view={view}
            hideSubtaskToggle
            display={
              <WorkspaceDisplayOptions sort={sort} onSortChange={setSort} />
            }
            actions={
              <ShowCompletedToggle
                checked={view.includeCompleted}
                onChange={view.setIncludeCompleted}
              />
            }
          />
        }
        filterBar={
          <ActiveFiltersBar
            subjects={view.subjects}
            onClear={filters.clearFilters}
          />
        }
      >
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
          {isError && <WorkspaceTasksError onRetry={() => void refetch()} />}

          {board && board.total > loadedTaskCount && (
            <p
              role="status"
              className="px-4 py-2 text-muted-foreground text-xs"
            >
              {t("workspace:tasks.truncated", {
                shown: loadedTaskCount,
                total: board.total,
              })}
            </p>
          )}

          <div className="flex h-full flex-1 overflow-hidden bg-background">
            {isInitialLoad ? (
              <BoardSkeleton />
            ) : sortedBoard && visibleTaskCount === 0 ? (
              <WorkspaceTasksEmpty filtered={isFiltered} />
            ) : sortedBoard ? (
              viewMode === "board" ? (
                <KanbanBoard
                  project={sortedBoard}
                  disableCollectionActions
                  disableTaskCreation
                  disableBulkActions
                  disableDragDrop={isError}
                  automaticSort={automaticSort}
                  onTaskStatusChange={handleTaskStatusChange}
                />
              ) : (
                <ListView
                  project={sortedBoard}
                  disableCollectionActions
                  disableTaskCreation
                  disableBulkActions
                  disableSubtasks
                  disableDragDrop={isError}
                  onTaskStatusChange={handleTaskStatusChange}
                />
              )
            ) : null}
          </div>

          <TaskDetailsSheet
            taskId={taskId}
            projectId={selectedTask?.projectId ?? openTask?.projectId ?? ""}
            workspaceId={selectedTask?.workspaceId ?? workspaceId}
            onClose={handleCloseTaskSheet}
          />
        </div>
      </WorkspaceLayout>
    </>
  );
}
