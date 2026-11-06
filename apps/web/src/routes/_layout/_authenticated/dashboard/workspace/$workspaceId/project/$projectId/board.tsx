import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import { BoardLoadError } from "@/components/project/board-load-error";
import { BoardRefreshError } from "@/components/project/board-refresh-error";
import { DisplaySection } from "@/components/project/display/display-section";
import { TaskDisplayOptions } from "@/components/project/display/task-display-options";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { SprintScopeSelect } from "@/components/project/toolbar/sprint-scope-select";
import { TaskCount } from "@/components/project/toolbar/task-count";
import { useProjectTaskView } from "@/components/project/toolbar/use-project-task-view";
import { useSprintScope } from "@/components/project/toolbar/use-sprint-scope";
import { LayoutSwitch } from "@/components/project/views/layout-switch";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import BoardSprintBanner from "@/components/sprint-planning/board-sprint-banner";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Skeleton } from "@/components/ui/skeleton";
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

const skeletonColumns = [
  { key: "col-todo", cards: 3 },
  { key: "col-progress", cards: 4 },
  { key: "col-review", cards: 2 },
  { key: "col-done", cards: 1 },
];

function BoardSkeleton() {
  return (
    <div className="delayed-reveal flex h-full w-full overflow-hidden bg-linear-to-b from-muted/20 to-background">
      <div className="flex h-full min-w-max gap-4 px-4 py-4 md:px-5">
        {skeletonColumns.map((col) => (
          <div
            key={col.key}
            className="flex h-full max-w-96 min-w-[min(20rem,calc(100vw-4.5rem))] shrink-0 flex-1 flex-col"
          >
            <div className="flex h-8 shrink-0 items-center gap-2 mt-1 pr-2 pl-3">
              <Skeleton className="size-3.5 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex flex-col gap-2 px-1.5 pt-1.5">
              {Array.from(
                { length: col.cards },
                (_, i) => `${col.key}-${i}`,
              ).map((cardKey) => (
                <div
                  key={cardKey}
                  className="flex flex-col gap-2.5 rounded-[10px] border border-board-card-border bg-board-card p-3"
                >
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
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
  const [sprintScope, setSprintScope] = useSprintScope(projectId);
  const view = useProjectTaskView({
    project,
    projectId,
    workspaceId,
    scope: "board",
    sprintScope,
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
    // The board shows the sprint slice picked in the sprint scope selector;
    // the filter menu restrictions apply on top of it.
    const filteredProject = view.filteredProject;
    if (!filteredProject || sort.field === "position") return filteredProject;
    return {
      ...filteredProject,
      columns: filteredProject.columns.map((column) => ({
        ...column,
        tasks: sortTasks(column.tasks, sort),
      })),
    };
  }, [view.filteredProject, sort]);

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="board"
      toolbar={
        <ProjectToolbar
          view={view}
          sprintScope={
            <SprintScopeSelect
              projectId={projectId}
              scope={sprintScope}
              onChange={setSprintScope}
            />
          }
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
          shown={countColumnTasks(view.filteredProject ?? null)}
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
        <BoardSprintBanner projectId={projectId} workspaceId={workspaceId} />
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
                sortedByNumber={sort.field === "number"}
                sortedByPriority={sort.field === "priority"}
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
