import BoardFilters, {
  type BoardFilters as BoardFiltersType,
} from "@/components/filters";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import useGetTasks from "@/hooks/queries/task/use-get-tasks";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
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
    sortBy: null,
    sortOrder: null,
  });

  useEffect(() => {
    if (data) {
      setProject(data);
    }
  }, [data, setProject]);

  const filterTasks = (tasks: Task[]): Task[] => {
    let filteredTasks = tasks
      .filter((task) => {
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
      })
      .map((task) => ({
        ...task,
        assigneeName: null,
        assigneeEmail: task.userEmail ?? null,
      }));

    // Sort tasks if sort parameters are provided
    if (filters.sortBy && filters.sortOrder) {
      filteredTasks = filteredTasks.sort((a, b) => {
        const sortOrder = filters.sortOrder === "asc" ? 1 : -1;

        switch (filters.sortBy) {
          case "title":
            return sortOrder * a.title.localeCompare(b.title);

          case "priority": {
            // Custom priority order: urgent > high > medium > low
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
            const aPriority = a.priority
              ? (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 999)
              : 999;
            const bPriority = b.priority
              ? (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 999)
              : 999;
            return sortOrder * (aPriority - bPriority);
          }

          case "dueDate": {
            // Handle cases where dueDate might be undefined
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return sortOrder;
            if (!b.dueDate) return -sortOrder;

            const aDate = new Date(a.dueDate).getTime();
            const bDate = new Date(b.dueDate).getTime();
            return sortOrder * (aDate - bDate);
          }

          case "createdAt": {
            const aDate = new Date(a.createdAt).getTime();
            const bDate = new Date(b.createdAt).getTime();
            return sortOrder * (aDate - bDate);
          }

          default:
            return 0;
        }
      });
    }

    return filteredTasks;
  };

  const filteredProject = project
    ? {
        ...project,
        columns:
          project.columns?.map((column) => ({
            id: column.id as "to-do" | "in-progress" | "in-review" | "done",
            name: column.name as "To Do" | "In Progress" | "In Review" | "Done",
            tasks: filterTasks(column.tasks).map((task) => ({
              id: task.id,
              title: task.title,
              number: task.number,
              description: task.description,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate,
              position: task.position,
              createdAt: task.createdAt,
              userEmail: task.userEmail,
              assigneeName: null,
              assigneeEmail: task.userEmail ?? null,
              projectId: task.projectId,
            })),
          })) ?? [],
        archivedTasks: filterTasks(project.archivedTasks).map((task) => ({
          id: task.id,
          title: task.title,
          number: task.number,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          position: task.position,
          createdAt: task.createdAt,
          userEmail: task.userEmail,
          assigneeName: null,
          assigneeEmail: task.userEmail ?? null,
          projectId: task.projectId,
        })),
        plannedTasks: filterTasks(project.plannedTasks).map((task) => ({
          id: task.id,
          title: task.title,
          number: task.number,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          position: task.position,
          createdAt: task.createdAt,
          userEmail: task.userEmail,
          assigneeName: null,
          assigneeEmail: task.userEmail ?? null,
          projectId: task.projectId,
        })),
      }
    : undefined;

  if (!filteredProject) {
    return <div>No project found</div>;
  }

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
