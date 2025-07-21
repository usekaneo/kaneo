import BacklogListView from "@/components/backlog-list-view";
import ProjectLayout from "@/components/common/project-layout";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetTasks from "@/hooks/queries/task/use-get-tasks";
import useGetActiveWorkspaceUsers from "@/hooks/queries/workspace-users/use-active-workspace-users";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
import { createFileRoute } from "@tanstack/react-router";
import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { produce } from "immer";
import {
  ArrowRight,
  Calendar,
  Check,
  Filter,
  Flag,
  Plus,
  Settings,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
)({
  component: RouteComponent,
});

interface BacklogFilters {
  priority: string | null;
  assignee: string | null;
  dueDate: string | null;
}

function RouteComponent() {
  const { projectId, workspaceId } = Route.useParams();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const { mutate: updateTask } = useUpdateTask();
  const [filters, setFilters] = useState<BacklogFilters>({
    priority: null,
    assignee: null,
    dueDate: null,
  });

  const { data: users } = useGetActiveWorkspaceUsers({ workspaceId });
  const {
    showAssignees,
    showPriority,
    showDueDates,
    showLabels,
    showTaskNumbers,
    toggleAssignees,
    togglePriority,
    toggleDueDates,
    toggleLabels,
    toggleTaskNumbers,
  } = useUserPreferencesStore();

  useEffect(() => {
    if (data) {
      setProject(data);
    }
  }, [data, setProject]);

  const filteredProject = useMemo(() => {
    if (!project) return null;

    const filterTasks = (tasks: Task[]): Task[] => {
      return tasks.filter((task) => {
        if (filters.priority && task.priority !== filters.priority) {
          return false;
        }

        if (filters.assignee && task.userEmail !== filters.assignee) {
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

        if (filters.dueDate === "No due date" && task.dueDate) {
          return false;
        }

        return true;
      });
    };

    return {
      ...project,
      plannedTasks: filterTasks(project.plannedTasks || []),
      archivedTasks: filterTasks(project.archivedTasks || []),
    };
  }, [project, filters]);

  const hasActiveFilters = Object.values(filters).some(
    (filter) => filter !== null,
  );

  const clearFilters = () => {
    setFilters({
      priority: null,
      assignee: null,
      dueDate: null,
    });
  };

  const updateFilter = (key: keyof BacklogFilters, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

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
    <ProjectLayout
      title="Backlog"
      projectId={projectId}
      workspaceId={workspaceId}
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="bg-card border-b border-border">
          <div className="h-10 flex items-center px-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsTaskModalOpen(true)}
                  className="h-6 px-2 text-xs text-zinc-600 dark:text-zinc-400"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Plan
                </Button>

                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleMoveAllPlannedToTodo}
                  className="h-6 px-2 text-xs text-zinc-600 dark:text-zinc-400"
                  title="Move All Planned to To Do"
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  Move All
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 px-2 text-xs",
                        hasActiveFilters
                          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
                          : "text-zinc-600 dark:text-zinc-400",
                      )}
                    >
                      <Filter className="h-3 w-3 mr-1" />
                      Filter
                      {hasActiveFilters && (
                        <span className="ml-1 bg-indigo-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                          {
                            Object.values(filters).filter((f) => f !== null)
                              .length
                          }
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          Filters
                        </h3>
                        {hasActiveFilters && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-700"
                          >
                            Clear all
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="p-1 space-y-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-left text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Flag className="w-3 h-3" />
                              <span>Priority</span>
                            </div>
                            {filters.priority && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded capitalize">
                                  {filters.priority}
                                </span>
                              </div>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-48 p-1"
                          align="start"
                          side="right"
                        >
                          {["urgent", "high", "medium", "low"].map(
                            (priority) => (
                              <button
                                key={priority}
                                type="button"
                                onClick={() =>
                                  updateFilter("priority", priority)
                                }
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md transition-colors",
                                  filters.priority === priority
                                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                                )}
                              >
                                <Flag
                                  className={cn(
                                    "w-3 h-3",
                                    priorityColorsTaskCard[
                                      priority as keyof typeof priorityColorsTaskCard
                                    ],
                                  )}
                                />
                                <span className="capitalize">{priority}</span>
                                {filters.priority === priority && (
                                  <Check className="h-3 w-3 ml-auto" />
                                )}
                              </button>
                            ),
                          )}
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-left text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3" />
                              <span>Assignee</span>
                            </div>
                            {filters.assignee && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                  {users?.find(
                                    (u) => u.userEmail === filters.assignee,
                                  )?.userName || "Unknown"}
                                </span>
                              </div>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-48 p-1"
                          align="start"
                          side="right"
                        >
                          {users?.map((user) => (
                            <button
                              key={user.userEmail}
                              type="button"
                              onClick={() =>
                                updateFilter("assignee", user.userEmail)
                              }
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md transition-colors",
                                filters.assignee === user.userEmail
                                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                              )}
                            >
                              <div className="w-5 h-5 bg-zinc-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {user.userName?.charAt(0).toUpperCase()}
                              </div>
                              <span>{user.userName}</span>
                              {filters.assignee === user.userEmail && (
                                <Check className="h-3 w-3 ml-auto" />
                              )}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-left text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3" />
                              <span>Due date</span>
                            </div>
                            {filters.dueDate && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                  {filters.dueDate}
                                </span>
                              </div>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-48 p-1"
                          align="start"
                          side="right"
                        >
                          {[
                            "Due this week",
                            "Due next week",
                            "No due date",
                          ].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => updateFilter("dueDate", option)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md transition-colors",
                                filters.dueDate === option
                                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                              )}
                            >
                              <Calendar className="w-3 h-3" />
                              <span>{option}</span>
                              {filters.dueDate === option && (
                                <Check className="h-3 w-3 ml-auto" />
                              )}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-zinc-600 dark:text-zinc-400"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Display
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0" align="start">
                    <div className="py-2">
                      <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Show Elements
                      </div>
                      <button
                        type="button"
                        onClick={toggleAssignees}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Show assignee</span>
                        {showAssignees && (
                          <div className="ml-auto w-2 h-2 bg-indigo-500 rounded-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={togglePriority}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span>Show priority</span>
                        {showPriority && (
                          <div className="ml-auto w-2 h-2 bg-indigo-500 rounded-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={toggleDueDates}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Show due date</span>
                        {showDueDates && (
                          <div className="ml-auto w-2 h-2 bg-indigo-500 rounded-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={toggleLabels}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <span className="w-3.5 h-3.5 bg-zinc-300 dark:bg-zinc-600 rounded-sm" />
                        <span>Show labels</span>
                        {showLabels && (
                          <div className="ml-auto w-2 h-2 bg-indigo-500 rounded-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={toggleTaskNumbers}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <span className="w-3.5 h-3.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 flex items-center justify-center">
                          #
                        </span>
                        <span>Show task numbers</span>
                        {showTaskNumbers && (
                          <div className="ml-auto w-2 h-2 bg-indigo-500 rounded-full" />
                        )}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-card h-full">
          {filteredProject ? (
            <BacklogListView project={filteredProject} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
            </div>
          )}
        </div>

        <CreateTaskModal
          open={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          status="planned"
        />
      </div>
    </ProjectLayout>
  );
}
