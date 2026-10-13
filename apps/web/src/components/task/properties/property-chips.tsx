import { ArrowRight, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { propertyChipClass } from "@/components/custom-fields/property-chip-class";
import icons from "@/constants/project-icons";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import { formatDateShort } from "@/lib/format";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { TaskCustomFieldChips } from "../custom-fields/task-custom-field-chips";
import TaskAssigneePopover from "../task-assignee-popover";
import TaskDueDatePopover from "../task-due-date-popover";
import TaskLabelsPopover from "../task-labels-popover";
import TaskMovePopover from "../task-move-popover";
import TaskPriorityPopover from "../task-priority-popover";
import TaskStartDatePopover from "../task-start-date-popover";
import TaskStatusPopover from "../task-status-popover";
import { AssigneeAvatar } from "./assignee-avatar";
import { dueDateTextClass } from "./due-date-text-class";
import { LabelsValue } from "./labels-value";
import { useTaskProperties } from "./use-task-properties";

type PropertyChipsProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
  className?: string;
};

const chip = cn(
  propertyChipClass,
  "h-8 bg-accent/30 text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
);
const dateButton =
  "flex h-full items-center gap-1.5 rounded-[5px] px-1.5 outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 data-popup-open:bg-accent";

export function PropertyChips({
  taskId,
  projectId,
  workspaceId,
  className,
}: PropertyChipsProps) {
  const { t } = useTranslation();
  const { task, project, labels, status, assignee, dueStatus, canMoveTask } =
    useTaskProperties(taskId, projectId, workspaceId);

  if (!task) return null;

  const ProjectIcon =
    icons[project?.icon as keyof typeof icons] || icons.Layout;
  const projectContent = (
    <>
      <ProjectIcon className="text-muted-foreground" />
      <span className="max-w-40 truncate">{project?.name}</span>
    </>
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <TaskStatusPopover task={task}>
          <button type="button" data-task-action="status" className={chip}>
            {getColumnIcon(task.status ?? "", status.isFinal, status.icon)}
            <span className="truncate">{status.label}</span>
          </button>
        </TaskStatusPopover>
        <TaskPriorityPopover task={task}>
          <button type="button" data-task-action="priority" className={chip}>
            {getPriorityIcon(task.priority ?? "")}
            <span className="truncate">
              {getPriorityLabel(task.priority ?? "")}
            </span>
          </button>
        </TaskPriorityPopover>
        <TaskAssigneePopover task={task} workspaceId={workspaceId}>
          <button
            type="button"
            data-task-action="assignee"
            className={cn(chip, "pl-1.5")}
          >
            <AssigneeAvatar
              name={assignee?.user?.name || task.assigneeName}
              image={assignee?.user?.image}
              assigned={Boolean(task.userId)}
            />
            <span
              className={cn(
                "max-w-32 truncate",
                !task.userId && "text-muted-foreground",
              )}
            >
              {assignee?.user?.name ||
                task.assigneeName ||
                t("tasks:popover.assignee.unassigned")}
            </span>
          </button>
        </TaskAssigneePopover>
        <div className={cn(chip, "gap-0.5 px-1 hover:bg-accent/30")}>
          <TaskStartDatePopover task={task}>
            <button type="button" className={dateButton}>
              <Calendar
                className={cn(
                  task.dueDate
                    ? dueDateTextClass[dueStatus]
                    : "text-muted-foreground",
                )}
              />
              <span className="text-muted-foreground">
                {task.startDate
                  ? formatDateShort(task.startDate)
                  : t("tasks:properties.start")}
              </span>
            </button>
          </TaskStartDatePopover>
          <ArrowRight className="text-muted-foreground/60" />
          <TaskDueDatePopover task={task}>
            <button
              type="button"
              data-task-action="dueDate"
              className={cn(
                dateButton,
                task.dueDate
                  ? dueDateTextClass[dueStatus]
                  : "text-muted-foreground",
              )}
            >
              {task.dueDate
                ? formatDateShort(task.dueDate)
                : t("tasks:dueDate.label")}
            </button>
          </TaskDueDatePopover>
        </div>
        <TaskLabelsPopover task={task} workspaceId={workspaceId}>
          <button
            type="button"
            data-task-action="labels"
            className={cn(chip, "h-auto min-h-8 py-1")}
          >
            <LabelsValue labels={labels} />
          </button>
        </TaskLabelsPopover>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {canMoveTask ? (
          <TaskMovePopover task={task} workspaceId={workspaceId}>
            <button type="button" data-task-action="move" className={chip}>
              {projectContent}
            </button>
          </TaskMovePopover>
        ) : (
          <span className={cn(chip, "hover:bg-accent/30")}>
            {projectContent}
          </span>
        )}
        <TaskCustomFieldChips
          taskId={taskId}
          projectId={projectId}
          className="h-8"
        />
      </div>
    </div>
  );
}
