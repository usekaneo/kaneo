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
  SquareCheck,
} from "lucide-react";
import {
  type CSSProperties,
  memo,
  useCallback,
  useMemo,
  useState,
} from "react";
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
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
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
import { getTaskItemStats } from "@/lib/get-task-item-stats";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import useBulkSelectionStore, {
  useIsTaskFocused,
  useIsTaskSelected,
} from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
import TaskCardContextMenuContent from "./task-card-context-menu/task-card-context-menu-content";
import { TaskLabels } from "./task-labels";

type TaskCardProps = {
  task: Task;
  disableDragDrop?: boolean;
  dragOverlay?: boolean;
};

type TaskCardContentProps = TaskCardProps & {
  isDragging?: boolean;
};

const TaskCardContent = memo(
  ({
    task,
    disableDragDrop = false,
    isDragging = false,
  }: TaskCardContentProps) => {
    const { t } = useTranslation();
    const projectId = useProjectStore((s) => s.project?.id);
    const projectSlug = useProjectStore((s) => s.project?.slug);
    const taskIsCompleted = useProjectStore((s) =>
      isTaskCompleted(task.status, s.project?.columns),
    );
    const { data: workspace } = useActiveWorkspace();
    const { mutateAsync: deleteTask } = useDeleteTask();
    const navigate = useNavigate();
    const showAssignees = useUserPreferencesStore((s) => s.showAssignees);
    const showPriority = useUserPreferencesStore((s) => s.showPriority);
    const showDueDates = useUserPreferencesStore((s) => s.showDueDates);
    const showLabels = useUserPreferencesStore((s) => s.showLabels);
    const showTaskNumbers = useUserPreferencesStore((s) => s.showTaskNumbers);
    const showTaskItemCounts = useUserPreferencesStore(
      (s) => s.showTaskItemCounts,
    );
    const [isDeleteTaskModalOpen, setIsDeleteTaskModalOpen] = useState(false);
    const toggleSelection = useBulkSelectionStore((s) => s.toggleSelection);
    const isTaskSelected = useIsTaskSelected(task.id);
    const isTaskFocused = useIsTaskFocused(task.id);
    const taskItemStats = useMemo(
      () => getTaskItemStats(task.description),
      [task.description],
    );

    const pullRequests = useMemo(() => {
      return (task.externalLinks ?? []).filter(
        (link) => link.resourceType === "pull_request",
      );
    }, [task.externalLinks]);

    const getPRInfo = useCallback(
      (pr: (typeof pullRequests)[number]) => {
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
      },
      [t],
    );

    const dueDateStatus = useMemo(
      () =>
        task.dueDate ? getDueDateStatus(task.dueDate, taskIsCompleted) : null,
      [task.dueDate, taskIsCompleted],
    );

    const singlePrInfo = useMemo(
      () => (pullRequests.length === 1 ? getPRInfo(pullRequests[0]) : null),
      [pullRequests, getPRInfo],
    );

    const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
      workspace?.id ?? "",
    );

    const assignee = useMemo(() => {
      return workspaceUsers?.members?.find(
        (member) => member.userId === task.userId,
      );
    }, [workspaceUsers, task.userId]);

    const handleTaskCardClick = useCallback(
      (
        e:
          | React.MouseEvent<HTMLDivElement>
          | React.KeyboardEvent<HTMLDivElement>,
      ) => {
        if (!projectId || !task || !workspace) return;

        if (
          (e as React.MouseEvent).metaKey ||
          (e as React.KeyboardEvent).ctrlKey
        ) {
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
      },
      [projectId, task, task.id, workspace, navigate, toggleSelection],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
          toggleSelection(task.id);
        }
      },
      [toggleSelection, task.id],
    );

    const handleDeleteTask = useCallback(async () => {
      try {
        await deleteTask(task.id);
        toast.success(t("tasks:delete.success"));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("tasks:delete.error"),
        );
      }
    }, [deleteTask, t, task.id]);

    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {/** biome-ignore lint/a11y/noStaticElementInteractions: false positive for onClick and onKeyDown */}
            <div
              onClick={handleTaskCardClick}
              className={`group relative rounded-lg border bg-background p-3 shadow-xs/5 transition-[background-color,border-color,box-shadow,scale] duration-150 ease-out active:scale-[0.98] ${
                disableDragDrop ? "cursor-default" : "cursor-move"
              } ${
                isDragging
                  ? "border-ring/40 bg-card shadow-lg"
                  : "hover:border-border/90 hover:bg-background hover:shadow-sm"
              } ${
                isTaskSelected
                  ? "border-ring/40 bg-accent/50 shadow-sm ring-1 ring-inset ring-ring/30"
                  : "border-border"
              } ${isTaskFocused ? "ring-2 ring-inset ring-ring/50" : ""}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTaskCardClick(e);
                } else if (e.key === "Escape") {
                  handleKeyDown(e);
                }
              }}
            >
              {showTaskNumbers && (
                <div className="mb-2 text-[10px] font-mono text-muted-foreground/90">
                  {projectSlug}-{task.number}
                </div>
              )}

              {showAssignees && (
                <div className="absolute top-3 right-3">
                  {task.userId ? (
                    <Avatar className="h-5 w-5">
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
                      className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted"
                      title={t("tasks:assignee.unassigned")}
                    >
                      <span className="text-[10px] font-medium text-muted-foreground">
                        ?
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-2.5 pr-6">
                <div
                  className="overflow-hidden break-words leading-5 font-medium text-foreground/95 text-[15px]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    wordBreak: "break-word",
                    hyphens: "auto",
                  }}
                >
                  {task.title}
                </div>
              </div>

              {showLabels && (
                <div className="mb-2.5">
                  <TaskLabels labels={task.labels ?? []} />
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {showPriority && (
                  <span className="inline-flex h-5.5 items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                    {getPriorityIcon(task.priority ?? "")}
                  </span>
                )}

                {showTaskItemCounts && taskItemStats.total > 0 && (
                  <span
                    className={cn(
                      "flex h-5.5 items-center gap-1 rounded bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground",
                      {
                        "bg-success/10 text-success-foreground":
                          taskItemStats.completed === taskItemStats.total,
                      },
                    )}
                  >
                    <SquareCheck className="h-[12px] w-[12px]" />
                    {taskItemStats.completed}/{taskItemStats.total}
                  </span>
                )}

                {showDueDates && task.dueDate && (
                  <div
                    className={`flex h-5.5 items-center gap-1 rounded px-2 py-1 text-[10px] ${dueDateStatusColors[getDueDateStatus(task.dueDate, taskIsCompleted)]}`}
                  >
                    {dueDateStatus === "overdue" && (
                      <CalendarX className="w-3 h-3" />
                    )}
                    {dueDateStatus === "due-soon" && (
                      <CalendarClock className="w-3 h-3" />
                    )}
                    {(dueDateStatus === "far-future" ||
                      dueDateStatus === "no-due-date") && (
                      <Calendar className="w-3 h-3" />
                    )}
                    <span>{format(new Date(task.dueDate), "MMM d")}</span>
                  </div>
                )}

                {pullRequests.length === 1 && (
                  <HoverCard openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(pullRequests[0].url, "_blank");
                        }}
                        className="inline-flex items-center gap-1.5 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground"
                      >
                        {singlePrInfo?.icon}
                        <span>#{pullRequests[0].externalId}</span>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent
                      className="w-72 p-3"
                      side="bottom"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
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
                            className="inline-flex items-center gap-1.5 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground"
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
                          onPointerDown={(e) => e.stopPropagation()}
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
                                  onClick={() => window.open(pr.url, "_blank")}
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
          </ContextMenuTrigger>

          {projectId && workspace && (
            <TaskCardContextMenuContent
              task={task}
              taskCardContext={{
                projectId,
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
      </>
    );
  },
);

function SortableTaskCard({ task, disableDragDrop = false }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: disableDragDrop });

  const style: CSSProperties = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition:
        transition || "transform 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      opacity: isDragging ? 0.6 : 1,
      touchAction: isDragging ? "none" : "auto",
      zIndex: isDragging ? 999 : "auto",
    }),
    [transform, transition, isDragging],
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCardContent
        task={task}
        disableDragDrop={disableDragDrop}
        isDragging={isDragging}
      />
    </div>
  );
}

function TaskCard({
  task,
  disableDragDrop = false,
  dragOverlay = false,
}: TaskCardProps) {
  if (dragOverlay) {
    return <TaskCardContent task={task} disableDragDrop />;
  }

  return <SortableTaskCard task={task} disableDragDrop={disableDragDrop} />;
}

export default memo(TaskCard);
