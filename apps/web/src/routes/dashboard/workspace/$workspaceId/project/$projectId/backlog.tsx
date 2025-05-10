import BacklogListView from "@/components/backlog-list-view";
import BoardFilters, {
  type BoardFilters as BoardFiltersType,
} from "@/components/filters";
import PageTitle from "@/components/page-title";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetTasks from "@/hooks/queries/task/use-get-tasks";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";
import { createFileRoute } from "@tanstack/react-router";
import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { produce } from "immer";
import { ArrowRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const { mutate: updateTask } = useUpdateTask();
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
    let filteredTasks = tasks.filter((task) => {
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

  const backlogProject = project
    ? {
        ...project,
        columns: [
          {
            id: "planned" as const,
            name: "Planned" as const,
            tasks: project.plannedTasks
              ? filterTasks(project.plannedTasks).map((task) => ({
                  ...task,
                  assigneeName: null,
                  assigneeEmail: null,
                }))
              : [],
          },
          {
            id: "archived" as const,
            name: "Archived" as const,
            tasks: project.archivedTasks
              ? filterTasks(project.archivedTasks).map((task) => ({
                  ...task,
                  assigneeName: null,
                  assigneeEmail: null,
                }))
              : [],
          },
        ],
        plannedTasks: project.plannedTasks
          ? filterTasks(project.plannedTasks).map((task) => ({
              ...task,
              assigneeName: null,
              assigneeEmail: null,
            }))
          : [],
        archivedTasks: project.archivedTasks
          ? filterTasks(project.archivedTasks).map((task) => ({
              ...task,
              assigneeName: null,
              assigneeEmail: null,
            }))
          : [],
      }
    : undefined;

  const handleMoveAllPlannedToTodo = () => {
    if (!project) return;

    const plannedTasks = project.plannedTasks || [];

    if (plannedTasks.length === 0) {
      toast.info("No planned tasks to move");
      return;
    }

    if (!confirm(`Move all ${plannedTasks.length} planned tasks to To Do?`)) {
      return;
    }

    for (const task of plannedTasks) {
      updateTask({
        ...task,
        status: "to-do",
      });
    }

    const updatedProject = produce(project, (draft) => {
      const todoColumn = draft.columns?.find((col) => col.id === "to-do");
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
    toast.success(`Moved ${plannedTasks.length} tasks to To Do`);
  };

  return (
    <div className="flex flex-col flex-1">
      <PageTitle title={`${project?.name || "Project"} · Backlog`} />
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Project - Backlog
          </h1>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(true)}
              className="h-8 bg-indigo-500 text-white text-xs font-medium rounded-l-md flex items-center"
            >
              <span className="px-1.5 flex items-center justify-center h-full">
                <Plus className="w-3.5 h-3.5" />
              </span>
              <span className="px-2">Plan Task</span>
            </button>

            <button
              type="button"
              onClick={handleMoveAllPlannedToTodo}
              className="h-8 bg-zinc-700 text-zinc-100 text-xs font-medium rounded-r-md flex items-center"
              title="Move All Planned to To Do"
            >
              <span className="px-1.5 flex items-center justify-center h-full">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
              <span className="px-2 hidden sm:inline">Move All</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <BoardFilters onFiltersChange={setFilters} />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* @ts-expect-error - TODO: fix this */}
        <BacklogListView project={backlogProject} />
      </div>

      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        status="planned"
      />
    </div>
  );
}
