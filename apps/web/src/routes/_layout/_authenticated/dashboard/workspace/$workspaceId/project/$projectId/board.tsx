import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import KanbanBoard from "@/components/kanban-board";
import BoardSkeleton from "@/components/kanban-board/board-skeleton";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import { BoardLoadError } from "@/components/project/board-load-error";
import { BoardRefreshError } from "@/components/project/board-refresh-error";
import { DisplaySection } from "@/components/project/display/display-section";
import { TaskDisplayOptions } from "@/components/project/display/task-display-options";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { TaskCount } from "@/components/project/toolbar/task-count";
import { useProjectTaskView } from "@/components/project/toolbar/use-project-task-view";
import { LayoutSwitch } from "@/components/project/views/layout-switch";
import { useGoToProjectView } from "@/components/project/views/use-go-to-project-view";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useBoardSort } from "@/hooks/use-board-sort";
import { cn } from "@/lib/cn";
import { sortTasks } from "@/lib/sort-tasks";
import { countColumnTasks } from "@/lib/task-filters/count-tasks";
import { useBackgroundStore } from "@/store/background";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ProjectWithTasks } from "@/types/project";

type BoardSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BoardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const goToView = useGoToProjectView({
    workspaceId,
    projectId,
    currentRoute: "board",
  });
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const {
    data,
    isError: boardError,
    isFetching: boardFetching,
    isSuccess: boardLoaded,
    refetch: retryBoard,
  } = useGetTasks(projectId);
  const { project: storedProject, setProject } = useProjectStore();
  const project: ProjectWithTasks | undefined =
    storedProject?.id === projectId ? storedProject : data;
  const viewMode = useUserPreferencesStore((state) => state.viewMode);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const { sort, setSort } = useBoardSort(projectId);
  const { background } = useBackgroundStore();
  const view = useProjectTaskView({
    project,
    projectId,
    workspaceId,
    scope: "board",
  });
  const { descriptionSearch, filters } = view;

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
      columns: filteredProject.columns.map((column) => ({
        ...column,
        tasks: sortTasks(column.tasks, sort),
      })),
    };
  }, [filters.filteredProject, sort]);

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="board"
      toolbar={
        <ProjectToolbar
          view={view}
          display={
            <>
              <DisplaySection>
                <LayoutSwitch currentView={viewMode} onSelect={goToView} />
              </DisplaySection>
              <TaskDisplayOptions
                projectId={projectId}
                sort={sort}
                onSortChange={setSort}
                layout={viewMode === "board" ? "cards" : "rows"}
                showBackgroundSwitch={
                  viewMode === "board" && !!project?.backgroundVersion
                }
              />
            </>
          }
        />
      }
      summary={
        <TaskCount
          shown={countColumnTasks(filters.filteredProject)}
          total={countColumnTasks(project)}
        />
      }
      filterBar={
        <ActiveFiltersBar
          subjects={view.subjects}
          onClear={filters.clearFilters}
          customFieldValues={filters.customFieldValues}
        />
      }
    >
      <PageTitle
        title={
          project
            ? `${project.name} / ${viewMode === "board" ? t("tasks:view.board") : t("tasks:view.list")}`
            : undefined
        }
      />
      <div className="relative flex flex-col h-full min-h-0 overflow-hidden">
        {descriptionSearch.isLoading && (
          <p role="status" className="px-4 py-2 text-sm text-muted-foreground">
            {t("tasks:descriptionSearchLoading")}
          </p>
        )}
        {descriptionSearch.isError && (
          <p role="alert" className="px-4 py-2 text-sm text-destructive">
            {t("tasks:descriptionSearchError")}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void descriptionSearch.retry()}
            >
              {t("tasks:descriptionRetry")}
            </button>
          </p>
        )}

        {boardError && sortedProject ? (
          <BoardRefreshError
            isRetrying={boardFetching}
            onRetry={() => void retryBoard()}
          />
        ) : null}
        <div
          className={cn("flex h-full flex-1 overflow-hidden", {
            "bg-background": !background,
          })}
        >
          {sortedProject ? (
            viewMode === "board" ? (
              <KanbanBoard
                key={projectId}
                project={sortedProject}
                disableCollectionActions={boardFetching || boardError}
                disableDragDrop={
                  (boardFetching && !boardLoaded) ||
                  boardError ||
                  (sort.field !== "position" &&
                    sort.field !== "number" &&
                    sort.field !== "priority")
                }
                automaticSort={
                  sort.field === "number" || sort.field === "priority"
                    ? sort.field
                    : undefined
                }
              />
            ) : (
              <ListView
                key={projectId}
                project={sortedProject}
                disableCollectionActions={boardFetching || boardError}
                disableDragDrop={
                  boardFetching || boardError || sort.field !== "position"
                }
              />
            )
          ) : boardError ? (
            <BoardLoadError
              isRetrying={boardFetching}
              onRetry={() => void retryBoard()}
            />
          ) : (
            <BoardSkeleton />
          )}
        </div>

        <CreateTaskModal
          open={isTaskModalOpen}
          projectId={projectId}
          onClose={() => setIsTaskModalOpen(false)}
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
