import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  Calendar,
  CalendarClock,
  CalendarX,
  ChevronRight,
  GitMerge,
  GitPullRequest,
} from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { cn } from "@/lib/cn";
import {
  dueDateStatusColors,
  getDueDateStatus,
  isTaskCompleted,
} from "@/lib/due-date-status";
import { getInitials } from "@/lib/get-initials";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
import TaskCardContextMenuContent from "../kanban-board/task-card-context-menu/task-card-context-menu-content";
import { TaskLabels } from "../kanban-board/task-labels";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";

type TaskRowProps = {
  task: Task;
  projectSlug: string;
  /** Nesting level; 0 for a task shown in its own status group. */
  depth?: number;
  /**
   * Identifies the row rather than the task. A subtask keeps its own top-level
   * row and is repeated under each parent, so the task id is not unique here
   * and cannot be used as a drag identity.
   */
  rowId?: string;
  childCount?: number;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  /**
   * Keeps the toggle column present on rows that have no toggle, so titles in
   * a group containing subtasks stay on one vertical line.
   */
  reserveToggleSpace?: boolean;
  /**
   * True while this task is being dragged from another of its rows. A subtask
   * is repeated under each parent, and only the top-level row is the drag
   * source, so the repeats would otherwise sit at full opacity beside it.
   */
  isTaskDragging?: boolean;
};

function TaskRow({
  task,
  projectSlug,
  depth = 0,
  rowId,
  childCount = 0,
  isExpanded = false,
  onToggleExpanded,
  reserveToggleSpace = false,
  isTaskDragging = false,
}: TaskRowProps) {
  const showToggleColumn = depth > 0 || childCount > 0 || reserveToggleSpace;
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Only the top-level row is a drag source. A nested repeat shares its task
  // id with that row, so making it sortable would register the same id twice
  // and move the wrong row.
  const isNestedRepeat = depth > 0;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rowId ?? task.id, disabled: isNestedRepeat });

  const { project } = useProjectStore();
  const taskIsCompleted = isTaskCompleted(task.status, project?.columns);
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
    return (task.externalLinks ?? []).filter(
      (link) => link.resourceType === "pull_request",
    );
  }, [task.externalLinks]);

  const getPRInfo = (pr: (typeof pullRequests)[number]) => {
    const isMerged = pr.metadata?.merged === true;
    const isDraft = pr.metadata?.draft === true;

    if (isMerged) {
      return {
        icon: <GitMerge className="h-3 w-3 text-info-foreground" />,
        status: t("tasks:pr.merged"),
        statusClass: "text-info-foreground",
      };
    }

    if (isDraft) {
      return {
        icon: <GitPullRequest className="h-3 w-3 text-muted-foreground" />,
        status: t("tasks:pr.draft"),
        statusClass: "text-muted-foreground",
      };
    }

    return {
      icon: <GitPullRequest className="h-3 w-3 text-success-foreground" />,
      status: t("tasks:pr.open"),
      statusClass: "text-success-foreground",
    };
  };

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms cubic-bezier(0.23, 1, 0.32, 1)",
    touchAction: isDragging ? "none" : "auto",
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
      return;
    }

    // Space activates a control with button semantics. Only the repeats need
    // it handled here: the top-level rows hand Space to dnd-kit, which starts
    // a keyboard drag with it.
    if (isNestedRepeat && e.key === " ") {
      // Opened before the default is prevented: handleClick ignores an event
      // that is already defaultPrevented, and preventing it anywhere in this
      // handler still stops the page scrolling.
      handleClick(e as unknown as React.MouseEvent);
      e.preventDefault();
    }
  };

  const handleDeleteTask = async () => {
    try {
      await deleteTask(task.id);
      toast.success(t("tasks:delete.success"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:delete.error"),
      );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // The indent and the toggle sit beside the draggable region rather
        // than inside it: dnd-kit gives its activator role="button", and a
        // button nested in one is an ambiguous control for assistive tech.
        "group flex items-stretch border-b border-border/50 transition-colors duration-150",
        (isDragging || isTaskDragging) && "opacity-50",
        isTaskSelected &&
          "bg-accent/60 shadow-sm ring-1 ring-inset ring-ring/30",
        isTaskFocused && "ring-2 ring-inset ring-ring/50",
      )}
    >
      {showToggleColumn && (
        <div
          className={cn(
            "flex flex-shrink-0 items-center pl-4",
            isTaskSelected ? "bg-accent/45" : "group-hover:bg-accent/60",
          )}
        >
          {depth > 0 && (
            <span
              aria-hidden="true"
              className="flex-shrink-0"
              // Indentation is capped so a deep chain cannot push the title
              // off the row; the chevrons still convey the nesting.
              style={{ width: `${Math.min(depth, 6) * 1.25}rem` }}
            />
          )}

          {childCount > 0 ? (
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-expanded={isExpanded}
              // Named with the task, not just the action: the toggle sits
              // outside the row's own control, so several identical "Show
              // subtasks" buttons would be indistinguishable in a rotor.
              aria-label={
                isExpanded
                  ? t("tasks:listView.collapseSubtasks", { title: task.title })
                  : t("tasks:listView.expandSubtasks", { title: task.title })
              }
              className="flex-shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronRight
                className={cn(
                  "w-3 h-3 transition-transform",
                  isExpanded && "rotate-90",
                )}
              />
            </button>
          ) : (
            <span aria-hidden="true" className="w-5 flex-shrink-0" />
          )}
        </div>
      )}

      <ContextMenu>
        <ContextMenuTrigger asChild>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: false positive for onClick and onKeyDown */}
          <div
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            // A repeated row opens its task like any other, so it keeps the
            // button semantics but takes none of dnd-kit's attributes: those
            // carry aria-disabled for a disabled sortable, which would tell
            // assistive technology the row cannot be used.
            {...(isNestedRepeat
              ? { role: "button" as const, tabIndex: 0 }
              : { ...attributes, ...listeners })}
            className={cn(
              "relative flex min-w-0 flex-1 items-center gap-3 py-1.5 pr-4 transition-colors cursor-pointer",
              showToggleColumn ? "pl-2" : "pl-4",
              isTaskSelected ? "bg-accent/45" : "group-hover:bg-accent/60",
            )}
          >
            {depth > 0 && (
              // The indent is decorative, so nesting is otherwise inaudible:
              // a repeat and its top-level row expose identical content. This
              // joins the row's accessible name, which the drag activator
              // builds from its text.
              <span className="sr-only">
                {t("tasks:listView.subtaskLevel", { level: depth })}
              </span>
            )}

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
                  {showLabels && <TaskLabels labels={task.labels ?? []} />}

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
                            {pullRequests[0].title || t("tasks:pr.label")}
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
                              <span>
                                {t("tasks:pr.count", {
                                  count: pullRequests.length,
                                })}
                              </span>
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
                                      {pr.title || t("tasks:pr.label")}
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
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded flex-shrink-0 ${dueDateStatusColors[getDueDateStatus(task.dueDate, taskIsCompleted)]}`}
              >
                {getDueDateStatus(task.dueDate, taskIsCompleted) ===
                  "overdue" && <CalendarX className="w-3 h-3" />}
                {getDueDateStatus(task.dueDate, taskIsCompleted) ===
                  "due-soon" && <CalendarClock className="w-3 h-3" />}
                {(getDueDateStatus(task.dueDate, taskIsCompleted) ===
                  "far-future" ||
                  getDueDateStatus(task.dueDate, taskIsCompleted) ===
                    "no-due-date") && <Calendar className="w-3 h-3" />}
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
                      {getInitials(assignee?.user?.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div
                    className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center"
                    title={t("tasks:assignee.unassigned")}
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
            <AlertDialogTitle>{t("tasks:delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks:delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteTask}
                />
              }
            >
              {t("tasks:delete.action")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TaskRow;
