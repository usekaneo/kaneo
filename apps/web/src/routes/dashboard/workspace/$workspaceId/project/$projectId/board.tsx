import type { BoardFilters as BoardFiltersType } from "@/components/filters";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import NotificationBell from "@/components/notification/notification-bell";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useGetTasks from "@/hooks/queries/task/use-get-tasks";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
import { createFileRoute } from "@tanstack/react-router";
import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { Filter, LayoutGrid, List, Plus, Search, SortAsc } from "lucide-react";
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
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
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

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      search: value,
    }));
  };

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
        assigneeEmail: task.userEmail ?? null,
      }));

    if (filters.sortBy && filters.sortOrder) {
      filteredTasks = filteredTasks.sort((a, b) => {
        const sortOrder = filters.sortOrder === "asc" ? 1 : -1;

        switch (filters.sortBy) {
          case "title":
            return sortOrder * a.title.localeCompare(b.title);

          case "priority": {
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
              status: task.status,
              dueDate: task.dueDate,
              priority: task.priority,
              position: task.position,
              createdAt: task.createdAt,
              userEmail: task.userEmail,
              number: task.number,
              description: task.description ?? null,
              assigneeEmail: task.userEmail ?? null,
              projectId: task.projectId,
              assigneeName: task.assigneeName ?? null,
            })),
          })) ?? [],
      }
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800">
        <div className="h-14 flex items-center px-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsTaskModalOpen(true);
                }}
                className="h-7 px-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New
              </Button>

              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <Input
                  value={filters.search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search tasks..."
                  className="h-7 w-[240px] pl-8 pr-3 text-xs bg-transparent border-zinc-200 dark:border-zinc-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs",
                    filters.assignee || filters.priority || filters.dueDate
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-zinc-600 dark:text-zinc-400",
                  )}
                >
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  <span className="hidden sm:inline">Filter</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs",
                    filters.sortBy
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-zinc-600 dark:text-zinc-400",
                  )}
                >
                  <SortAsc className="h-3.5 w-3.5 mr-1.5" />
                  <span className="hidden sm:inline">Sort</span>
                </Button>
              </div>

              <div className="border-l border-zinc-200 dark:border-zinc-800 h-4 mx-1 hidden sm:block" />

              <div className="flex items-center">
                <Button
                  variant={viewMode === "board" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-1.5"
                  onClick={() => {
                    useUserPreferencesStore.setState({ viewMode: "board" });
                  }}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-1.5"
                  onClick={() => {
                    useUserPreferencesStore.setState({ viewMode: "list" });
                  }}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>

              <NotificationBell />
            </div>
          </div>
        </div>

        <div className="sm:hidden px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <Input
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search tasks..."
              className="h-8 w-full pl-8 pr-3 text-xs bg-transparent border-zinc-200 dark:border-zinc-800"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-black/[0.03] dark:bg-black/30">
        {filteredProject ? (
          viewMode === "board" ? (
            <KanbanBoard project={filteredProject} />
          ) : (
            <ListView project={filteredProject} />
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
          </div>
        )}
      </div>

      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
      />
    </div>
  );
}
