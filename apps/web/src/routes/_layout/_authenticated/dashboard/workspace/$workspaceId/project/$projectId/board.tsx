import ProjectLayout from "@/components/common/project-layout";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
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
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortcuts } from "@/constants/shortcuts";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useTaskFilters } from "@/hooks/use-task-filters";
import { cn } from "@/lib/cn";
import { getPriorityIcon } from "@/lib/priority";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
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
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId, workspaceId } = Route.useParams();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const { viewMode } = useUserPreferencesStore();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
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
      <PageTitle
        title={`${project?.name} · ${viewMode === "board" ? "Board" : "List"}`}
        hideAppName
      />
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
                        description="Create new task"
                      />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 px-2 text-xs",
                        hasActiveFilters
                          ? "text-foreground bg-accent"
                          : "text-muted-foreground",
                      )}
                    >
                      <Filter className="h-3 w-3 mr-1" />
                      Filter
                      {hasActiveFilters && (
                        <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                          {
                            Object.values(filters).filter((f) => f !== null)
                              .length
                          }
                        </span>
                      )}
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
                        <div className="w-2 h-2 border border-muted-foreground rounded-full" />
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
                            <span>{column.name}</span>
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2">
                        <Flag className="w-4 h-4" />
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
                        <User className="w-4 h-4" />
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
                            <div className="w-5 h-5 bg-muted-foreground rounded-full flex items-center justify-center text-background text-xs font-medium">
                              {member.user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <span>{member.user?.name}</span>
                          </DropdownMenuCheckboxItem>
                        ))}
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
                      <Settings className="h-3 w-3 mr-1" />
                      Display
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-46" align="start">
                    <DropdownMenuCheckboxItem
                      checked={viewMode === "board"}
                      onCheckedChange={() => {
                        useUserPreferencesStore.setState({
                          viewMode: "board",
                        });
                      }}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span>Board view</span>
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={viewMode === "list"}
                      onCheckedChange={() => {
                        useUserPreferencesStore.setState({
                          viewMode: "list",
                        });
                      }}
                    >
                      <List className="w-4 h-4" />
                      <span>List view</span>
                    </DropdownMenuCheckboxItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuCheckboxItem
                      checked={showAssignees}
                      onCheckedChange={toggleAssignees}
                    >
                      <User className="w-4 h-4" />
                      <span>Show assignee</span>
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={showPriority}
                      onCheckedChange={togglePriority}
                    >
                      <Flag className="w-4 h-4" />
                      <span>Show priority</span>
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={showDueDates}
                      onCheckedChange={toggleDueDates}
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Show due date</span>
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={showLabels}
                      onCheckedChange={toggleLabels}
                    >
                      <span className="w-4 h-4 bg-muted-foreground rounded-sm" />
                      <span>Show labels</span>
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={showTaskNumbers}
                      onCheckedChange={toggleTaskNumbers}
                    >
                      <span className="w-4 h-4 text-sm font-mono text-muted-foreground flex items-center justify-center">
                        #
                      </span>
                      <span>Show task numbers</span>
                    </DropdownMenuCheckboxItem>
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
