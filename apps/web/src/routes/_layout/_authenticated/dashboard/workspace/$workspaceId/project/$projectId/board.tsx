import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import { DisplaySection } from "@/components/project/display/display-section";
import { TaskDisplayOptions } from "@/components/project/display/task-display-options";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { TaskCount } from "@/components/project/toolbar/task-count";
import { useProjectTaskView } from "@/components/project/toolbar/use-project-task-view";
import { LayoutSwitch } from "@/components/project/views/layout-switch";
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

const skeletonColumns = [
  { key: "col-todo", cards: 3 },
  { key: "col-progress", cards: 4 },
  { key: "col-review", cards: 2 },
  { key: "col-done", cards: 1 },
];

function BoardSkeleton() {
  return (
    <div className="flex h-full w-full gap-4 p-4 overflow-hidden">
      {skeletonColumns.map((col) => (
        <div key={col.key} className="flex w-72 shrink-0 flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-4 w-5 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: col.cards }, (_, i) => `${col.key}-${i}`).map(
              (cardKey) => (
                <div
                  key={cardKey}
                  className="rounded-lg border border-border bg-card p-3 space-y-2.5"
                >
                  <div className="h-3.5 w-4/5 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-3/5 rounded bg-muted animate-pulse" />
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
                    <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const {
    data,
    isError: boardError,
    isFetching: boardFetching,
    refetch: retryBoard,
  } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
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
                <LayoutSwitch
                  workspaceId={workspaceId}
                  projectId={projectId}
                  currentRoute="board"
                  currentView={viewMode}
                />
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
        title={`${project?.name} · ${viewMode === "board" ? t("tasks:view.board") : t("tasks:view.list")}`}
        hideAppName
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

        {boardError && (
          <p role="alert" className="p-4 text-destructive">
            {t("tasks:calendar.loadError")}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void retryBoard()}
            >
              {t("tasks:descriptionRetry")}
            </button>
          </p>
        )}
        <div
          className={cn("flex h-full flex-1 overflow-hidden", {
            "bg-background": !background,
          })}
        >
          {sortedProject ? (
            viewMode === "board" ? (
              <KanbanBoard
                project={sortedProject}
                disableCollectionActions={boardFetching || boardError}
                disableDragDrop={
                  boardFetching ||
                  boardError ||
                  (sort.field !== "position" &&
                    sort.field !== "number" &&
                    sort.field !== "priority")
                }
                sortedByNumber={sort.field === "number"}
                sortedByPriority={sort.field === "priority"}
              />
            ) : (
              <ListView
                project={sortedProject}
                disableCollectionActions={boardFetching || boardError}
                disableDragDrop={
                  boardFetching || boardError || sort.field !== "position"
                }
              />
            )
          ) : boardError ? null : (
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
