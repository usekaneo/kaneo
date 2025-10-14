import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { produce } from "immer";
import { ArrowRight, Calendar, Filter, Plus, User, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import BacklogListView from "@/components/backlog-list-view";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import labelColors from "@/constants/label-colors";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getPriorityIcon } from "@/lib/priority";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/backlog",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId, workspaceId } = Route.useParams();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const { mutate: updateTask } = useUpdateTask();

  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    priority: null as string | null,
    assignee: null as string | null,
    dueDate: null as string | null,
    labels: [] as string[],
  });

  const updateFilter = (key: string, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateLabelFilter = (labelId: string) => {
    setFilters((prev) => ({
      ...prev,
      labels: prev.labels.includes(labelId)
        ? prev.labels.filter((id) => id !== labelId)
        : [...prev.labels, labelId],
    }));
  };

  const clearFilters = () => {
    setFilters({
      priority: null,
      assignee: null,
      dueDate: null,
      labels: [],
    });
  };

  const hasActiveFilters = Object.values(filters).some((filter) =>
    Array.isArray(filter) ? filter.length > 0 : filter !== null,
  );

  useEffect(() => {
    if (data) {
      setProject(data);
    }
  }, [data, setProject]);

  const getPriorityDisplayName = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  const getAssigneeDisplayName = (userId: string) => {
    const member = users?.members?.find((m) => m.userId === userId);
    return member?.user?.name || "Unknown";
  };

  const getTaskLabels = useCallback(
    (taskId: string) => {
      const queryKey = ["labels", taskId];
      const cachedData = queryClient.getQueryData(queryKey) as
        | Array<{ id: string; name: string; color: string }>
        | undefined;
      return cachedData || [];
    },
    [queryClient],
  );

  const filteredProject = useMemo(() => {
    if (!project) return null;

    const filterTasks = (tasks: Task[]) => {
      return tasks.filter((task) => {
        if (filters.priority && task.priority !== filters.priority) {
          return false;
        }

        if (filters.assignee && task.userId !== filters.assignee) {
          return false;
        }

        if (filters.dueDate && task.dueDate) {
          const today = new Date();
          const taskDate = new Date(task.dueDate);

          switch (filters.dueDate) {
            case "Due this week": {
              const weekStart = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate() - today.getDay(),
              );
              const weekEnd = new Date(
                weekStart.getTime() + 6 * 24 * 60 * 60 * 1000,
              );
              if (taskDate < weekStart || taskDate > weekEnd) {
                return false;
              }
              break;
            }
            case "Due next week": {
              const nextWeekStart = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate() - today.getDay() + 7,
              );
              const nextWeekEnd = new Date(
                nextWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000,
              );
              if (taskDate < nextWeekStart || taskDate > nextWeekEnd) {
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

        if (filters.labels.length > 0) {
          const taskLabels = getTaskLabels(task.id);
          const taskLabelIds = taskLabels.map((label) => label.id);
          const hasMatchingLabel = filters.labels.some((filterLabelId) =>
            taskLabelIds.includes(filterLabelId),
          );
          if (!hasMatchingLabel) {
            return false;
          }
        }

        return true;
      });
    };

    return {
      ...project,
      plannedTasks: filterTasks(project.plannedTasks || []),
      archivedTasks: filterTasks(project.archivedTasks || []),
    };
  }, [project, filters, getTaskLabels]);

  const uniqueLabels = workspaceLabels.reduce(
    (
      acc: { id: string; name: string; color: string }[],
      label: { id: string; name: string; color: string },
    ) => {
      const existing = acc.find(
        (l) => l.name === label.name && l.color === label.color,
      );
      if (!existing) {
        acc.push(label);
      }
      return acc;
    },
    [],
  );

  const isLabelGroupSelected = (label: { name: string; color: string }) => {
    return workspaceLabels
      .filter(
        (l: { name: string; color: string }) =>
          l.name === label.name && l.color === label.color,
      )
      .some((l: { id: string }) => filters.labels?.includes(l.id));
  };

  const toggleLabelGroup = (label: { name: string; color: string }) => {
    const matchingLabels = workspaceLabels.filter(
      (l: { name: string; color: string }) =>
        l.name === label.name && l.color === label.color,
    );

    const isAnySelected = matchingLabels.some((l: { id: string }) =>
      filters.labels?.includes(l.id),
    );

    if (isAnySelected) {
      for (const l of matchingLabels) {
        if (filters.labels?.includes(l.id)) {
          updateLabelFilter(l.id);
        }
      }
    } else {
      for (const l of matchingLabels) {
        if (!filters.labels?.includes(l.id)) {
          updateLabelFilter(l.id);
        }
      }
    }
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
    <ProjectLayout projectId={projectId} workspaceId={workspaceId}>
      <PageTitle title={`${project?.name}'s backlog`} />
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

                {filters.priority && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1.5"
                  >
                    {getPriorityIcon(filters.priority)}
                    <span>
                      Priority is {getPriorityDisplayName(filters.priority)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-3 w-3 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFilter("priority", null);
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </Button>
                )}

                {filters.assignee && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1.5"
                  >
                    <User className="h-3 w-3" />
                    <span>
                      Assignee is {getAssigneeDisplayName(filters.assignee)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-3 w-3 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFilter("assignee", null);
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </Button>
                )}

                {filters.dueDate && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1.5"
                  >
                    <Calendar className="h-3 w-3" />
                    <span>Due date is {filters.dueDate}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-3 w-3 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFilter("dueDate", null);
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </Button>
                )}

                {filters.labels &&
                  filters.labels.length > 0 &&
                  uniqueLabels
                    .filter((uniqueLabel) =>
                      workspaceLabels
                        .filter(
                          (l: { name: string; color: string }) =>
                            l.name === uniqueLabel.name &&
                            l.color === uniqueLabel.color,
                        )
                        .some((l: { id: string }) =>
                          filters.labels?.includes(l.id),
                        ),
                    )
                    .map((label) => (
                      <Button
                        key={`${label.name}-${label.color}`}
                        variant="secondary"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1.5"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              labelColors.find((c) => c.value === label.color)
                                ?.color || "#94a3b8",
                          }}
                        />
                        <span>Label is {label.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-3 w-3 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLabelGroup(label);
                          }}
                        >
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </Button>
                    ))}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground"
                    >
                      <Filter className="h-3 w-3 mr-1" />
                      Filter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-46" align="start">
                    {hasActiveFilters && (
                      <>
                        <DropdownMenuItem onClick={clearFilters}>
                          <span>Clear all filters</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2">
                        <span>Priority</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48">
                        {["urgent", "high", "medium", "low"].map((priority) => (
                          <DropdownMenuCheckboxItem
                            key={priority}
                            checked={filters.priority === priority}
                            onCheckedChange={() =>
                              updateFilter("priority", priority)
                            }
                            className="[&_svg]:text-muted-foreground"
                          >
                            {getPriorityIcon(priority)}
                            <span className="capitalize">{priority}</span>
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2">
                        <span>Assignee</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48">
                        {users?.members?.map((member) => (
                          <DropdownMenuCheckboxItem
                            key={member.userId}
                            checked={filters.assignee === member.userId}
                            onCheckedChange={() =>
                              updateFilter("assignee", member.userId)
                            }
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={member.user?.image ?? ""}
                                alt={member.user?.name || ""}
                              />
                              <AvatarFallback className="text-xs font-medium border border-border/30">
                                {member.user?.name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.user?.name}</span>
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2">
                        <span>Due Date</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48">
                        {["Due this week", "Due next week", "No due date"].map(
                          (dueDate) => (
                            <DropdownMenuCheckboxItem
                              key={dueDate}
                              checked={filters.dueDate === dueDate}
                              onCheckedChange={() =>
                                updateFilter("dueDate", dueDate)
                              }
                            >
                              <span>{dueDate}</span>
                            </DropdownMenuCheckboxItem>
                          ),
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2">
                        <span>Labels</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48">
                        {uniqueLabels.map(
                          (label: {
                            id: string;
                            name: string;
                            color: string;
                          }) => (
                            <DropdownMenuCheckboxItem
                              key={label.id}
                              checked={isLabelGroupSelected(label)}
                              onCheckedChange={() => toggleLabelGroup(label)}
                            >
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor:
                                    labelColors.find(
                                      (c) => c.value === label.color,
                                    )?.color || "#94a3b8",
                                }}
                              />
                              <span>{label.name}</span>
                            </DropdownMenuCheckboxItem>
                          ),
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-card h-full">
          {filteredProject ? (
            <BacklogListView project={filteredProject} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse mx-auto" />
                <div className="space-y-2">
                  <div className="w-48 h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mx-auto" />
                  <div className="w-64 h-3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mx-auto" />
                </div>
              </div>
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
