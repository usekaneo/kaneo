import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  Filter,
  Layout,
  List,
  Settings2,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import ProjectLayout from "@/components/common/project-layout";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
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
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";
import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId, workspaceId } = Route.useParams();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const { viewMode, setViewMode } = useUserPreferencesStore();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);

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
      <div className="flex flex-col h-full min-h-0">
        <div className="bg-card border-b border-border">
          <div className="h-10 flex items-center px-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {/* Individual Filter Chips */}
                {filters.status && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1.5"
                  >
                    {getColumnIcon(filters.status)}
                    <span>
                      Status is {getStatusDisplayName(filters.status)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-3 w-3 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
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
                        <span>Status</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48">
                        {project?.columns?.map((column) => (
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={filters.status === column.id}
                            onCheckedChange={() =>
                              updateFilter("status", column.id)
                            }
                          >
                            {getColumnIcon(column.id)}
                            <span>{column.name}</span>
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground"
                    >
                      <Settings2 className="h-3 w-3 mr-1" />
                      Display
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-40" align="start">
                    <DropdownMenuItem
                      onClick={() => setViewMode("board")}
                      className={`gap-2 ${viewMode === "board" ? "bg-accent" : ""}`}
                    >
                      <Layout className="h-3 w-3" />
                      <span>Board</span>
                      {viewMode === "board" && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setViewMode("list")}
                      className={`gap-2 ${viewMode === "list" ? "bg-accent" : ""}`}
                    >
                      <List className="h-3 w-3" />
                      <span>List</span>
                      {viewMode === "list" && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
