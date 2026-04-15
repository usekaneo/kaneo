import {
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Copy,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import labelColors from "@/constants/label-colors";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getColumnIcon } from "@/lib/column";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { formatDateShort } from "@/lib/format";
import { generateLink } from "@/lib/generate-link";
import { getPriorityLabel, getStatusLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import TaskAssigneePopover from "./task-assignee-popover";
import TaskDueDatePopover from "./task-due-date-popover";
import TaskLabelsPopover from "./task-labels-popover";
import TaskPriorityPopover from "./task-priority-popover";
import TaskStartDatePopover from "./task-start-date-popover";
import TaskStatusPopover from "./task-status-popover";

type TaskPropertiesSidebarProps = {
  taskId: string | undefined;
  projectId: string;
  workspaceId: string;
  className?: string;
  compact?: boolean;
};

export default function TaskPropertiesSidebar({
  taskId,
  projectId,
  workspaceId,
  className,
  compact = false,
}: TaskPropertiesSidebarProps) {
  const { t } = useTranslation();
  const { data: task } = useGetTask(taskId ?? "");
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: taskLabels = [] } = useGetLabelsByTask(taskId ?? "");

  const assignee = workspaceUsers?.members?.find(
    (member) => member.userId === task?.userId,
  );

  const handleCopyTaskLink = () => {
    navigator.clipboard.writeText(
      generateLink(
        `/dashboard/workspace/${workspaceId}/project/${projectId}/task/${taskId}`,
      ),
    );
    toast.message(t("tasks:properties.copyTaskLink"));
  };

  return (
    <div className={className}>
      {/* Compact mode: properties + icons in one row */}
      {compact && (
        <div className="flex flex-row-reverse gap-2 w-full border-b border-border">
          <div className="flex px-3 py-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-foreground"
                    onClick={() => handleCopyTaskLink()}
                  >
                    <Copy className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <KbdSequence
                    keys={["Ctrl", "Shift", "C"]}
                    description={t("tasks:properties.copyTaskLink")}
                    separator=""
                  />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex flex-row flex-wrap gap-1 items-center p-2 w-full">
            {task && (
              <TaskStatusPopover task={task}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start h-7 px-1.5 gap-1.5"
                >
                  {getColumnIcon(task.status ?? "", false)}
                  <span className="text-xs font-semibold truncate">
                    {getStatusLabel(task.status ?? "")}
                  </span>
                </Button>
              </TaskStatusPopover>
            )}
            {task && (
              <TaskPriorityPopover task={task}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start h-7 px-1.5 gap-1.5"
                >
                  {getPriorityIcon(task.priority ?? "")}
                  <span className="text-xs font-semibold truncate">
                    {getPriorityLabel(task.priority ?? "")}
                  </span>
                </Button>
              </TaskPriorityPopover>
            )}
            {task && (
              <TaskAssigneePopover task={task} workspaceId={workspaceId}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start h-7 px-1.5 gap-1.5"
                >
                  {task.userId ? (
                    <Avatar className="h-[16px] w-[16px]">
                      <AvatarImage
                        src={assignee?.user?.image ?? ""}
                        alt={assignee?.user?.name || ""}
                      />
                      <AvatarFallback className="text-[9px] font-medium border border-border/30 flex-shrink-0 h-[16px] w-[16px]">
                        {assignee?.user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div
                      className="w-[16px] h-[16px] rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0"
                      title={t("tasks:popover.assignee.unassigned")}
                    >
                      <span className="text-[8px] font-medium">?</span>
                    </div>
                  )}
                  <span className="text-xs font-semibold truncate max-w-[100px]">
                    {assignee?.user?.name ||
                      task.assigneeName ||
                      t("tasks:popover.assignee.unassigned")}
                  </span>
                </Button>
              </TaskAssigneePopover>
            )}
            {task && (
              <TaskStartDatePopover task={task}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start h-7 px-1.5 gap-1.5"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                  <span
                    className={`text-xs font-semibold ${task.startDate ? "" : "text-muted-foreground"}`}
                  >
                    {task.startDate
                      ? formatDateShort(task.startDate)
                      : t("tasks:properties.start")}
                  </span>
                </Button>
              </TaskStartDatePopover>
            )}
            {task && (
              <TaskDueDatePopover task={task}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start h-7 px-1.5 gap-1.5"
                >
                  {task.dueDate ? (
                    <>
                      {getDueDateStatus(task.dueDate) === "overdue" && (
                        <CalendarX
                          className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                        />
                      )}
                      {getDueDateStatus(task.dueDate) === "due-soon" && (
                        <CalendarClock
                          className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                        />
                      )}
                      {(getDueDateStatus(task.dueDate) === "far-future" ||
                        getDueDateStatus(task.dueDate) === "no-due-date") && (
                        <Calendar
                          className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                        />
                      )}
                      <span className="text-xs font-semibold">
                        {formatDateShort(task.dueDate)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">
                        {t("tasks:properties.noDate")}
                      </span>
                    </>
                  )}
                </Button>
              </TaskDueDatePopover>
            )}
          </div>
        </div>
      )}

      {!compact && (
        <>
          {/* Mobile: Compact-style layout */}
          <div className="flex flex-row-reverse gap-2 w-full border-b border-border lg:hidden">
            <div className="flex px-3 py-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-foreground"
                      onClick={() => handleCopyTaskLink()}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <KbdSequence
                      keys={["Ctrl", "Shift", "C"]}
                      description={t("tasks:properties.copyTaskLink")}
                      separator=""
                    />
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex flex-row flex-wrap gap-1 items-center p-2 w-full">
              {task && (
                <TaskStatusPopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5"
                  >
                    {getColumnIcon(task.status ?? "", false)}
                    <span className="text-xs font-semibold truncate">
                      {getStatusLabel(task.status ?? "")}
                    </span>
                  </Button>
                </TaskStatusPopover>
              )}
              {task && (
                <TaskPriorityPopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5"
                  >
                    {getPriorityIcon(task.priority ?? "")}
                    <span className="text-xs font-semibold truncate">
                      {getPriorityLabel(task.priority ?? "")}
                    </span>
                  </Button>
                </TaskPriorityPopover>
              )}
              {task && (
                <TaskAssigneePopover task={task} workspaceId={workspaceId}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5"
                  >
                    {task.userId ? (
                      <Avatar className="h-[16px] w-[16px]">
                        <AvatarImage
                          src={assignee?.user?.image ?? ""}
                          alt={assignee?.user?.name || ""}
                        />
                        <AvatarFallback className="text-[9px] font-medium border border-border/30 shrink-0 h-[16px] w-[16px]">
                          {assignee?.user?.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div
                        className="w-[16px] h-[16px] rounded-full bg-muted border border-border flex items-center justify-center shrink-0"
                        title={t("tasks:popover.assignee.unassigned")}
                      >
                        <span className="text-[8px] font-medium">?</span>
                      </div>
                    )}
                    <span className="text-xs font-semibold truncate max-w-[100px]">
                      {assignee?.user?.name ||
                        task.assigneeName ||
                        t("tasks:popover.assignee.unassigned")}
                    </span>
                  </Button>
                </TaskAssigneePopover>
              )}
              {task && (
                <TaskStartDatePopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5"
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                    <span
                      className={`text-xs font-semibold ${task.startDate ? "" : "text-muted-foreground"}`}
                    >
                      {task.startDate
                        ? formatDateShort(task.startDate)
                        : t("tasks:properties.start")}
                    </span>
                  </Button>
                </TaskStartDatePopover>
              )}
              {task && (
                <TaskDueDatePopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5"
                  >
                    {task.dueDate ? (
                      <>
                        {getDueDateStatus(task.dueDate) === "overdue" && (
                          <CalendarX
                            className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                          />
                        )}
                        {getDueDateStatus(task.dueDate) === "due-soon" && (
                          <CalendarClock
                            className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                          />
                        )}
                        {(getDueDateStatus(task.dueDate) === "far-future" ||
                          getDueDateStatus(task.dueDate) === "no-due-date") && (
                          <Calendar
                            className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                          />
                        )}
                        <span className="text-xs font-semibold">
                          {formatDateShort(task.dueDate)}
                        </span>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">
                          {t("tasks:properties.noDate")}
                        </span>
                      </>
                    )}
                  </Button>
                </TaskDueDatePopover>
              )}
            </div>
          </div>

          {/* Desktop: Title + stacked properties */}
          <div className="hidden lg:block">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border lg:border-none">
              <p className="text-sm font-medium text-foreground/70 flex-1">
                {t("tasks:properties.title")}
              </p>
              <div className="flex">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-foreground"
                        onClick={() => handleCopyTaskLink()}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <KbdSequence
                        keys={["Ctrl", "Shift", "C"]}
                        description={t("tasks:properties.copyTaskLink")}
                        separator=""
                      />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="flex flex-col gap-2 px-3 py-3">
              {task && (
                <TaskStatusPopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5 w-full"
                  >
                    {getColumnIcon(task.status ?? "", false)}
                    <span className="text-xs font-semibold truncate">
                      {getStatusLabel(task.status ?? "")}
                    </span>
                  </Button>
                </TaskStatusPopover>
              )}
              {task && (
                <TaskPriorityPopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5 w-full"
                  >
                    {getPriorityIcon(task.priority ?? "")}
                    <span className="text-xs font-semibold truncate">
                      {getPriorityLabel(task.priority ?? "")}
                    </span>
                  </Button>
                </TaskPriorityPopover>
              )}
              {task && (
                <TaskAssigneePopover task={task} workspaceId={workspaceId}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5 w-full"
                  >
                    {task.userId ? (
                      <Avatar className="h-[16px] w-[16px]">
                        <AvatarImage
                          src={assignee?.user?.image ?? ""}
                          alt={assignee?.user?.name || ""}
                        />
                        <AvatarFallback className="text-[9px] font-medium border border-border/30 shrink-0 h-[16px] w-[16px]">
                          {assignee?.user?.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div
                        className="w-[16px] h-[16px] rounded-full bg-muted border border-border flex items-center justify-center shrink-0"
                        title={t("tasks:popover.assignee.unassigned")}
                      >
                        <span className="text-[8px] font-medium">?</span>
                      </div>
                    )}
                    <span className="text-xs font-semibold truncate max-w-[100px]">
                      {assignee?.user?.name ||
                        task.assigneeName ||
                        t("tasks:popover.assignee.unassigned")}
                    </span>
                  </Button>
                </TaskAssigneePopover>
              )}
              {task && (
                <TaskStartDatePopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5 w-full"
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                    <span
                      className={`text-xs font-semibold ${task.startDate ? "" : "text-muted-foreground"}`}
                    >
                      {task.startDate
                        ? formatDateShort(task.startDate)
                        : t("tasks:properties.startDate")}
                    </span>
                  </Button>
                </TaskStartDatePopover>
              )}
              {task && (
                <TaskDueDatePopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 px-1.5 gap-1.5 w-full"
                  >
                    {task.dueDate ? (
                      <>
                        {getDueDateStatus(task.dueDate) === "overdue" && (
                          <CalendarX
                            className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                          />
                        )}
                        {getDueDateStatus(task.dueDate) === "due-soon" && (
                          <CalendarClock
                            className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                          />
                        )}
                        {(getDueDateStatus(task.dueDate) === "far-future" ||
                          getDueDateStatus(task.dueDate) === "no-due-date") && (
                          <Calendar
                            className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                          />
                        )}
                        <span className="text-xs font-semibold">
                          {formatDateShort(task.dueDate)}
                        </span>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">
                          {t("tasks:properties.noDate")}
                        </span>
                      </>
                    )}
                  </Button>
                </TaskDueDatePopover>
              )}
            </div>
          </div>
        </>
      )}

      <div className="hidden lg:flex px-3 flex-col gap-3 p-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground/70 px-2">
            {t("tasks:properties.labels")}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 px-2">
            {task &&
              taskLabels.length > 0 &&
              taskLabels.map(
                (label: { id: string; name: string; color: string }) => (
                  <TaskLabelsPopover
                    key={`edit-${label.id}`}
                    task={task}
                    workspaceId={workspaceId}
                    triggerNativeButton={false}
                  >
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 px-1.5 py-0.5 cursor-pointer hover:bg-accent/50 transition-colors text-[10px]"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            labelColors.find((c) => c.value === label.color)
                              ?.color || "var(--color-neutral-400)",
                        }}
                      />
                      <span className="relative max-w-20 truncate -top-0.5">
                        {label.name}
                      </span>
                    </Badge>
                  </TaskLabelsPopover>
                ),
              )}

            {task && (
              <TaskLabelsPopover task={task} workspaceId={workspaceId}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 rounded-full"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TaskLabelsPopover>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
