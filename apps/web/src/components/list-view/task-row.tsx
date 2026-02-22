import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  Calendar,
  CalendarClock,
  CalendarX,
  GitMerge,
  GitPullRequest,
} from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import useExternalLinks from "@/hooks/queries/external-link/use-external-links";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { cn } from "@/lib/cn";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import queryClient from "@/query-client";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
import TaskCardContextMenuContent from "../kanban-board/task-card-context-menu/task-card-context-menu-content";
import TaskCardLabels from "../kanban-board/task-labels";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";

type TaskRowProps = {
  task: Task;
  projectSlug: string;
};

function TaskRow({ task, projectSlug }: TaskRowProps) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const { project } = useProjectStore();
  const { data: workspace } = useActiveWorkspace();
  const {
    showAssignees,
    showPriority,
    showDueDates,
    showLabels,
    showTaskNumbers,
  } = useUserPreferencesStore();
  const [isDeleteTaskModalOpen, setIsDeleteTaskModalOpen] = useState(false);
  const { mutateAsync: deleteTask } = useDeleteTask();
  const { data: externalLinks } = useExternalLinks(task.id);
  const { toggleSelection, isSelected, isFocused } = useBulkSelectionStore();
  const isTaskSelected = isSelected(task.id);
  const isTaskFocused = isFocused(task.id);

  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    workspace?.id ?? "",
  );

  const assignee = useMemo(() => {
    return workspaceUsers?.members?.find(
      (member) => member.userId === task.userId,
    );
  }, [workspaceUsers, task.userId]);

  const pullRequests = useMemo(() => {
    if (!externalLinks) return [];
    return externalLinks.filter((link) => link.resourceType === "pull_request");
  }, [externalLinks]);

  const getPRInfo = (pr: (typeof pullRequests)[number]) => {
    const isMerged = pr.metadata?.merged === true;
    const isDraft = pr.metadata?.draft === true;

    if (isMerged) {
      return {
        icon: <GitMerge className="h-3 w-3 text-info-foreground" />,
        status: "Merged",
        statusClass: "text-info-foreground",
      };
    }

    if (isDraft) {
      return {
        icon: <GitPullRequest className="h-3 w-3 text-muted-foreground" />,
        status: "Draft",
        statusClass: "text-muted-foreground",
      };
    }

    return {
      icon: <GitPullRequest className="h-3 w-3 text-success-foreground" />,
      status: "Open",
      statusClass: "text-success-foreground",
    };
  };

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition:
      transition || "transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    touchAction: "none",
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!project || !task) return;
    if (e.defaultPrevented) return;

    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleSelection(task.id);
      return;
    }

    const currentParams = new URLSearchParams(window.location.search);
    const currentTaskId = currentParams.get("taskId");

    if (currentTaskId === task.id) {
      navigate({
        to: ".",
        search: {},
      });
    } else {
      navigate({
        to: ".",
        search: { taskId: task.id },
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleClick(e as unknown as React.MouseEvent);
    }
  };

  const handleDeleteTask = async () => {
    try {
      await deleteTask(task.id);
      queryClient.invalidateQueries({
        queryKey: ["tasks", project?.id],
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete task",
      );
    } finally {
      toast.success("Task deleted successfully");
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-border/50 transition-all duration-200",
        isDragging && "opacity-50",
        isTaskSelected && "bg-accent/50 shadow-sm",
        isTaskFocused && "ring-2 ring-inset ring-ring/50",
      )}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: false positive for onClick and onKeyDown */}
          <div
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className="group relative flex items-center gap-3 px-4 py-1.5 hover:bg-accent/60 transition-colors cursor-pointer"
            {...attributes}
            {...listeners}
          >
            {showPriority && (
              <div className="flex-shrink-0 first:[&_svg]:h-4 first:[&_svg]:w-4">
                {getPriorityIcon(task.priority ?? "")}
              </div>
            )}
            {showTaskNumbers && (
              <div className="text-xs font-mono text-muted-foreground flex-shrink-0">
                {projectSlug}-{task.number}
              </div>
            )}

            <div className="flex-1 min-w-0 flex items-center gap-2">
              <div className="flex items-center gap-2 justify-between w-full">
                <span className="text-sm text-foreground truncate">
                  {task.title}
                </span>
                <div className="flex items-center gap-1">
                  {showLabels && <TaskCardLabels taskId={task.id} />}

                  {pullRequests.length === 1 && (
                    <HoverCard openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(pullRequests[0].url, "_blank");
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-sidebar text-[10px] font-medium text-muted-foreground"
                        >
                          {getPRInfo(pullRequests[0]).icon}
                          <span>#{pullRequests[0].externalId}</span>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent
                        className="w-72 p-3"
                        side="bottom"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {getPRInfo(pullRequests[0]).icon}
                            <span>{getPRInfo(pullRequests[0]).status}</span>
                            <span className="text-muted-foreground/50">•</span>
                            <span>#{pullRequests[0].externalId}</span>
                          </div>
                          <p className="text-sm font-medium leading-snug">
                            {pullRequests[0].title || "Pull Request"}
                          </p>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  )}

                  {pullRequests.length > 1 &&
                    (() => {
                      const hasOpen = pullRequests.some(
                        (pr) => !pr.metadata?.merged && !pr.metadata?.draft,
                      );
                      const allMerged = pullRequests.every(
                        (pr) => pr.metadata?.merged,
                      );
                      const iconColor = allMerged
                        ? "text-info-foreground"
                        : hasOpen
                          ? "text-success-foreground"
                          : "text-muted-foreground";

                      return (
                        <HoverCard openDelay={200} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-sidebar text-[10px] font-medium text-muted-foreground"
                            >
                              <GitPullRequest
                                className={`h-3 w-3 ${iconColor}`}
                              />
                              <span>{pullRequests.length} PRs</span>
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent
                            className="w-auto min-w-56 max-w-96 p-1"
                            side="bottom"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {pullRequests.map((pr, index) => {
                              const prInfo = getPRInfo(pr);
                              const repoMatch = pr.url.match(
                                /github\.com\/([^/]+\/[^/]+)\/pull/,
                              );
                              const repoName = repoMatch ? repoMatch[1] : null;
                              return (
                                <div key={pr.id}>
                                  {index > 0 && (
                                    <hr className="border-border my-1" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      window.open(pr.url, "_blank")
                                    }
                                    className="w-full px-2 py-1.5 text-left hover:bg-muted/50 rounded transition-colors"
                                  >
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      {prInfo.icon}
                                      <span>
                                        {repoName}#{pr.externalId}
                                      </span>
                                    </div>
                                    <p className="text-xs leading-tight line-clamp-2 mt-0.5">
                                      {pr.title || "Pull Request"}
                                    </p>
                                    <span className="text-[10px] text-muted-foreground">
                                      {prInfo.status}
                                    </span>
                                  </button>
                                </div>
                              );
                            })}
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })()}
                </div>
              </div>
            </div>

            {showDueDates && task.dueDate && (
              <div
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded flex-shrink-0 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
              >
                {getDueDateStatus(task.dueDate) === "overdue" && (
                  <CalendarX className="w-3 h-3" />
                )}
                {getDueDateStatus(task.dueDate) === "due-soon" && (
                  <CalendarClock className="w-3 h-3" />
                )}
                {(getDueDateStatus(task.dueDate) === "far-future" ||
                  getDueDateStatus(task.dueDate) === "no-due-date") && (
                  <Calendar className="w-3 h-3" />
                )}
                <span>{format(new Date(task.dueDate), "MMM d")}</span>
              </div>
            )}

            {showAssignees && (
              <div className="flex-shrink-0">
                {task.userId ? (
                  <Avatar className="h-6 w-6">
                    <AvatarImage
                      src={assignee?.user?.image ?? ""}
                      alt={assignee?.user?.name || ""}
                    />
                    <AvatarFallback className="text-xs font-medium border border-border/30">
                      {assignee?.user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div
                    className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center"
                    title="Unassigned"
                  >
                    <span className="text-[10px] font-medium text-muted-foreground">
                      ?
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        {project && workspace && (
          <TaskCardContextMenuContent
            task={task}
            taskCardContext={{
              projectId: project.id,
              worskpaceId: workspace.id,
            }}
            onDeleteClick={() => setIsDeleteTaskModalOpen(true)}
          />
        )}
      </ContextMenu>

      <AlertDialog
        open={isDeleteTaskModalOpen}
        onOpenChange={setIsDeleteTaskModalOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the task and all its data. You can't
              undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>Cancel</AlertDialogClose>
            <AlertDialogClose
              onClick={handleDeleteTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Task
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TaskRow;
