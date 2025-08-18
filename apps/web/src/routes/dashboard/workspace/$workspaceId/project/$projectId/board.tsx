import ProjectLayout from "@/components/common/project-layout";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortcuts } from "@/constants/shortcuts";
import useGetTasks from "@/hooks/queries/task/use-get-tasks";
import useGetActiveWorkspaceUsers from "@/hooks/queries/workspace-users/use-active-workspace-users";
import { useTaskFilters } from "@/hooks/use-task-filters";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  Check,
  Filter,
  Flag,
  LayoutGrid,
  List,
  Plus,
  Settings,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute(
  "/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId, workspaceId } = Route.useParams();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const { viewMode } = useUserPreferencesStore();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

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

  const {
    filters,
    updateFilter,
    filteredProject,
    hasActiveFilters,
    clearFilters,
  } = useTaskFilters(project);

  return (
    <ProjectLayout
      title={viewMode === "board" ? "Board" : "List"}
      projectId={projectId}
      workspaceId={workspaceId}
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="bg-card border-b border-border">
          <div className="h-10 flex items-center px-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setIsTaskModalOpen(true)}
                        className="h-6 px-2 text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        New task
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <KbdSequence
                        keys={[shortcuts.task.prefix, shortcuts.task.create]}
                        className="ml-auto"
                      />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

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
                              <div className="w-2 h-2 border border-zinc-400 rounded-full" />
                              <span>Status</span>
                            </div>
                            {filters.status && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded capitalize">
                                  {filters.status.replace("-", " ")}
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
                          {project?.columns?.map((column) => (
                            <button
                              key={column.id}
                              type="button"
                              onClick={() => updateFilter("status", column.id)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md transition-colors",
                                filters.status === column.id
                                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                              )}
                            >
                              <span>{column.name}</span>
                              {filters.status === column.id && (
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
                                    priority === "urgent" && "text-red-500",
                                    priority === "high" && "text-orange-500",
                                    priority === "medium" && "text-yellow-500",
                                    priority === "low" && "text-green-500",
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
                                    (u) => u.userId === filters.assignee,
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
                              key={user.userId}
                              type="button"
                              onClick={() =>
                                updateFilter("assignee", user.userId)
                              }
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md transition-colors",
                                filters.assignee === user.userId
                                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                              )}
                            >
                              <div className="w-5 h-5 bg-zinc-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {user.userName?.charAt(0).toUpperCase()}
                              </div>
                              <span>{user.userName}</span>
                              {filters.assignee === user.userId && (
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
                        Layout
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          useUserPreferencesStore.setState({
                            viewMode: "board",
                          });
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors",
                          viewMode === "board"
                            ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                        )}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Board</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          useUserPreferencesStore.setState({
                            viewMode: "list",
                          });
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors",
                          viewMode === "list"
                            ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                        )}
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>List</span>
                      </button>

                      <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-2" />

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
    </ProjectLayout>
  );
}
