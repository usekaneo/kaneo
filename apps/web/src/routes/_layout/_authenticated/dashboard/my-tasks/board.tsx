import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BoardToolbar from "@/components/board/board-toolbar";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import MyTasksLayout from "@/components/my-tasks/my-tasks-layout";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { TaskViewProvider } from "@/components/task/task-view-context";
import { Input } from "@/components/ui/input";
import { useBoardSort } from "@/hooks/use-board-sort";
import { useMyTasksView } from "@/hooks/use-my-tasks-view";
import { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";
import { WorkspacePermissionScope } from "@/hooks/use-workspace-permission";
import { MY_TASKS_BOARD_ID } from "@/lib/assigned-board";
import { type SortConfig, sortTasks } from "@/lib/sort-tasks";
import { useUserPreferencesStore } from "@/store/user-preferences";

type MyTasksSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/my-tasks/board",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): MyTasksSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

const DEFAULT_SORT: SortConfig = { field: "dueDate", direction: "asc" };

function RouteComponent() {
  const { t } = useTranslation();
  const { taskId } = Route.useSearch();
  const { viewMode, setViewMode } = useUserPreferencesStore();
  const [searchQuery, setSearchQuery] = useState("");
  const { sort, setSort } = useBoardSort(MY_TASKS_BOARD_ID, DEFAULT_SORT);
  const {
    board,
    projects,
    labels,
    taskView,
    getProjectSlug,
    isLoading,
    isError,
    sheet,
  } = useMyTasksView(taskId);

  const {
    filters,
    updateFilter,
    updateLabelFilter,
    filteredProject,
    hasActiveFilters,
    clearFilters,
  } = useTaskFiltersWithLabelsSupport(
    board,
    MY_TASKS_BOARD_ID,
    searchQuery,
    getProjectSlug,
  );

  const sortedBoard = useMemo(() => {
    if (!filteredProject || sort.field === "position") return filteredProject;
    return {
      ...filteredProject,
      columns: filteredProject.columns.map((column) => ({
        ...column,
        tasks: sortTasks(column.tasks, sort),
      })),
    };
  }, [filteredProject, sort]);

  const hasNoAssignments =
    board?.columns.every((column) => column.tasks.length === 0) ?? false;
  const hasNoMatches =
    !hasNoAssignments &&
    (sortedBoard?.columns.every((column) => column.tasks.length === 0) ??
      false);

  return (
    <MyTasksLayout
      activeView="board"
      headerActions={
        <div className="relative w-[200px]">
          <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("tasks:boardSearchPlaceholder")}
            className="h-7.5 [&_[data-slot=input]]:h-7 [&_[data-slot=input]]:leading-7 [&_[data-slot=input]]:pl-8 [&_[data-slot=input]]:text-xs [&_[data-slot=input]]:placeholder:text-xs [&_[data-slot=input]]:placeholder:leading-7"
          />
        </div>
      }
    >
      {/* Mounted once data is in, so this effect runs after the dashboard
          layout's own title effect and wins. */}
      {board && (
        <PageTitle
          title={t("tasks:myTasks.pageTitle", {
            view:
              viewMode === "board"
                ? t("tasks:view.board")
                : t("tasks:view.list"),
          })}
          hideAppName
        />
      )}
      <TaskViewProvider value={taskView}>
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
          <BoardToolbar
            project={board}
            projects={projects}
            showAssigneeFilter={false}
            filters={filters}
            updateFilter={updateFilter}
            updateLabelFilter={updateLabelFilter}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            workspaceLabels={labels}
            viewMode={viewMode}
            setViewMode={setViewMode}
            sort={sort}
            onSortChange={setSort}
          />

          <div className="flex h-full flex-1 overflow-hidden bg-background">
            {isError ? (
              <StatusMessage title={t("tasks:myTasks.loadError")} />
            ) : isLoading || !sortedBoard ? (
              <StatusMessage title={t("common:empty.loading")} muted />
            ) : hasNoAssignments ? (
              <StatusMessage
                title={t("tasks:myTasks.empty")}
                subtitle={t("tasks:myTasks.emptySubtitle")}
              />
            ) : hasNoMatches ? (
              <StatusMessage
                title={t("tasks:myTasks.noMatches")}
                subtitle={t("tasks:myTasks.noMatchesSubtitle")}
              />
            ) : viewMode === "board" ? (
              <KanbanBoard project={sortedBoard} disableDragDrop />
            ) : (
              <ListView project={sortedBoard} disableDragDrop />
            )}
          </div>

          <WorkspacePermissionScope value={sheet.workspaceId}>
            <TaskDetailsSheet
              taskId={sheet.taskId}
              projectId={sheet.projectId ?? ""}
              workspaceId={sheet.workspaceId ?? ""}
              onClose={sheet.onClose}
            />
          </WorkspacePermissionScope>
        </div>
      </TaskViewProvider>
    </MyTasksLayout>
  );
}

function StatusMessage({
  title,
  subtitle,
  muted = false,
}: {
  title: string;
  subtitle?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <p
          className={
            muted
              ? "text-sm text-muted-foreground"
              : "text-sm font-semibold text-foreground"
          }
        >
          {title}
        </p>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
