import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Calendar,
  Filter,
  Layout,
  List,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ProjectLayout from "@/components/common/project-layout";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import labelColors from "@/constants/label-colors";
import { shortcuts } from "@/constants/shortcuts";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";
import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
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

function RouteComponent() {
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const { viewMode, setViewMode } = useUserPreferencesStore();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);

  const handleCloseTaskSheet = useCallback(() => {
    navigate({
      to: ".",
      search: {},
      replace: true,
    });
  }, [navigate]);

  useRegisterShortcuts({
    sequentialShortcuts: {
      [shortcuts.view.prefix]: {
        [shortcuts.view.board]: () => setViewMode("board"),
        [shortcuts.view.list]: () => setViewMode("list"),
        [shortcuts.view.backlog]: () =>
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
            params: { workspaceId, projectId },
          }),
      },
    },
  });

  useEffect(() => {
    if (data) {
      setProject(data);
    }
  }, [data, setProject]);

  const {
    filters,
    updateFilter,
    updateLabelFilter,
    filteredProject,
    hasActiveFilters,
    clearFilters,
  } = useTaskFiltersWithLabelsSupport(project);

  // Helper functions to get display names for filters
  const getStatusDisplayName = (statusId: string) => {
    const column = project?.columns?.find((col) => col.id === statusId);
    return column?.name || statusId;
  };

  const getPriorityDisplayName = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  const getAssigneeDisplayName = (userId: string) => {
    const member = users?.members?.find((m) => m.userId === userId);
    return member?.user?.name || "Unknown";
  };

  // Deduplicate workspace labels by name and color combination
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

  return (
    <ProjectLayout projectId={projectId} workspaceId={workspaceId}>
      <PageTitle
        title={`${project?.name} — ${viewMode === "board" ? "Board" : "List"}`}
        hideAppName
      />
      <div className="relative flex flex-col h-full min-h-0 overflow-hidden">
        <div className="bg-card border-b border-border/80">
          <div className="h-10 flex items-center px-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {/* Individual Filter Chips */}
                {filters.status && (
                  <Button
                    variant="secondary"
                    size="xs"
                    className="h-7 rounded-md px-2 text-xs font-medium"
                  >
                    <span>Status: {getStatusDisplayName(filters.status)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFilter("status", null);
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </Button>
                )}

                {filters.priority && (
                  <Button
                    variant="secondary"
                    size="xs"
                    className="h-7 rounded-md px-2 text-xs font-medium gap-1.5"
                  >
                    {getPriorityIcon(filters.priority)}
                    <span>
                      Priority: {getPriorityDisplayName(filters.priority)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
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
                    size="xs"
                    className="h-7 rounded-md px-2 text-xs font-medium gap-1.5"
                  >
                    <User className="h-3 w-3" />
                    <span>
                      Assignee: {getAssigneeDisplayName(filters.assignee)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
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
                    size="xs"
                    className="h-7 rounded-md px-2 text-xs font-medium gap-1.5"
                  >
                    <Calendar className="h-3 w-3" />
                    <span>Due: {filters.dueDate}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
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
                  // Group selected labels by name/color and show only unique chips
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
                        size="xs"
                        className="h-7 rounded-md px-2 text-xs font-medium gap-1.5"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              labelColors.find((c) => c.value === label.color)
                                ?.color || "var(--color-neutral-400)",
                          }}
                        />
                        <span>Label: {label.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
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
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 px-3 font-medium text-foreground"
                      />
                    }
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filter
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-80"
                    align="start"
                  >
                    <DropdownMenuItem
                      disabled
                      className="h-8 rounded-md border border-border/80 bg-card text-sm text-muted-foreground"
                    >
                      Add filter...
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {hasActiveFilters && (
                      <>
                        <DropdownMenuItem
                          onClick={clearFilters}
                          className="h-8 text-sm text-muted-foreground"
                        >
                          <span>Clear all filters</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                        Status
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {project?.columns?.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={filters.status === column.id}
                        onCheckedChange={(checked) =>
                          updateFilter("status", checked ? column.id : null)
                        }
                        className="h-8 rounded-md text-sm"
                      >
                        {getColumnIcon(column.id, column.isFinal)}
                        <span>{column.name}</span>
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                        Priority
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {["urgent", "high", "medium", "low"].map((priority) => (
                      <DropdownMenuCheckboxItem
                        key={priority}
                        checked={filters.priority === priority}
                        onCheckedChange={(checked) =>
                          updateFilter("priority", checked ? priority : null)
                        }
                        className="h-8 rounded-md text-sm [&_svg]:text-sidebar-foreground"
                      >
                        {getPriorityIcon(priority)}
                        <span className="capitalize">{priority}</span>
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                        Assignee
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {users?.members?.map((member) => (
                      <DropdownMenuCheckboxItem
                        key={member.userId}
                        checked={filters.assignee === member.userId}
                        onCheckedChange={(checked) =>
                          updateFilter("assignee", checked ? member.userId : null)
                        }
                        className="h-8 rounded-md text-sm"
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

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                        Due date
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {["Due this week", "Due next week", "No due date"].map(
                      (dueDate) => (
                        <DropdownMenuCheckboxItem
                          key={dueDate}
                          checked={filters.dueDate === dueDate}
                          onCheckedChange={(checked) =>
                            updateFilter("dueDate", checked ? dueDate : null)
                          }
                          className="h-8 rounded-md text-sm"
                        >
                          <span>{dueDate}</span>
                        </DropdownMenuCheckboxItem>
                      ),
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                        Labels
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {uniqueLabels.length > 0 ? (
                      uniqueLabels.map(
                        (label: {
                          id: string;
                          name: string;
                          color: string;
                        }) => (
                          <DropdownMenuCheckboxItem
                            key={label.id}
                            checked={isLabelGroupSelected(label)}
                            onCheckedChange={() => toggleLabelGroup(label)}
                            className="h-8 rounded-md text-sm"
                          >
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  labelColors.find((c) => c.value === label.color)
                                    ?.color || "var(--color-neutral-400)",
                              }}
                            />
                            <span>{label.name}</span>
                          </DropdownMenuCheckboxItem>
                        ),
                      )
                    ) : (
                      <DropdownMenuItem
                        disabled
                        className="h-8 rounded-md text-sm text-muted-foreground"
                      >
                        <span>No labels available</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5">
                  <Button
                    variant={viewMode === "board" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 gap-1.5 rounded-md px-3 text-sm font-medium"
                    onClick={() => setViewMode("board")}
                  >
                    <Layout className="h-3.5 w-3.5" />
                    Board
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 gap-1.5 rounded-md px-3 text-sm font-medium"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-3.5 w-3.5" />
                    List
                  </Button>
                </div>
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
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
            </div>
          )}
        </div>

        <CreateTaskModal
          open={isTaskModalOpen}
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
