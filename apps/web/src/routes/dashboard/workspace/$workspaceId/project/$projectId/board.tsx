import BoardFilters, {
  type BoardFilters as BoardFiltersType,
} from "@/components/filters";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import useGetTasks from "@/hooks/queries/task/use-get-tasks";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { Task } from "@/types/project";
import { createFileRoute } from "@tanstack/react-router";
import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { useEffect, useState } from "react";

export const Route = createFileRoute(
  "/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const { viewMode } = useUserPreferencesStore();
  const [filters, setFilters] = useState<BoardFiltersType>({
    search: "",
    assignee: null,
    priority: null,
    dueDate: null,
  });

  useEffect(() => {
    if (data) {
      setProject(data);
    }
  }, [data, setProject]);

  const filterTasks = (tasks: Task[]): Task[] => {
    return tasks.filter((task) => {
      if (
        filters.search &&
        !task.title.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      if (filters.assignee && task.userEmail !== filters.assignee) {
        return false;
      }

      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }

      if (filters.dueDate && task.dueDate) {
        const today = new Date();
        const taskDate = new Date(task.dueDate);

        switch (filters.dueDate) {
          case "Due this week": {
            const weekStart = startOfWeek(today);
            const weekEnd = endOfWeek(today);
            if (
              !isWithinInterval(taskDate, { start: weekStart, end: weekEnd })
            ) {
              return false;
            }
            break;
          }
          case "Due next week": {
            const nextWeekStart = startOfWeek(addWeeks(today, 1));
            const nextWeekEnd = endOfWeek(addWeeks(today, 1));
            if (
              !isWithinInterval(taskDate, {
                start: nextWeekStart,
                end: nextWeekEnd,
              })
            ) {
              return false;
            }
            break;
          }
          case "No due date": {
            return false;
          }
        }
      }

      return true;
    });
  };

  const filteredProject = project
    ? {
        ...project,
        columns: project.columns?.map((column) => ({
          ...column,
          tasks: filterTasks(column.tasks),
        })),
      }
    : undefined;

  return (
    <div className="flex flex-col flex-1">
      <PageTitle
        title={`${project?.name || "Board"} · ${viewMode === "board" ? "Kanban" : "List"}`}
      />
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          {project?.name}
        </h1>

        <div className="flex items-center">
          <BoardFilters onFiltersChange={setFilters} />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {viewMode === "board" ? (
          <KanbanBoard project={filteredProject} />
        ) : (
          <ListView project={filteredProject} />
        )}
      </div>
    </div>
  );
}
