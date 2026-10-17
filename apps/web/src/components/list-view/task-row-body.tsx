import { useTranslation } from "react-i18next";
import { CardFieldList } from "@/components/custom-fields/card-field-list";
import { useTaskCardFields } from "@/components/custom-fields/use-task-card-fields";
import TaskPriorityPopover from "@/components/task/task-priority-popover";
import { TaskPullRequests } from "@/components/task/task-pull-requests";
import { AssigneeButton } from "@/components/task-chips/assignee-button";
import { ChecklistChip } from "@/components/task-chips/checklist-chip";
import { DueDateChip } from "@/components/task-chips/due-date-chip";
import { LabelChips } from "@/components/task-chips/label-chips";
import { stopCardEvents } from "@/components/task-chips/stop-card-events";
import { SubtasksChip } from "@/components/task-chips/subtasks-chip";
import { cn } from "@/lib/cn";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";

const inlineMetaClass =
  "h-5 gap-1 border-transparent bg-transparent px-1 font-normal text-muted-foreground hover:border-transparent hover:text-foreground data-popup-open:border-transparent";

const rowButtonClass =
  "flex shrink-0 cursor-pointer items-center rounded-md outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/25 data-popup-open:bg-accent";

type TaskRowBodyProps = {
  task: Task;
  projectSlug: string | undefined;
  workspaceId: string;
  isCompleted: boolean;
  assigneeName: string | null | undefined;
  assigneeImage: string | null | undefined;
  showPullRequests?: boolean;
};

export function TaskRowBody({
  task,
  projectSlug,
  workspaceId,
  isCompleted,
  assigneeName,
  assigneeImage,
  showPullRequests = true,
}: TaskRowBodyProps) {
  const { t } = useTranslation();
  const {
    showAssignees,
    showPriority,
    showDueDates,
    showLabels,
    showTaskNumbers,
    showTaskItemCounts,
  } = useUserPreferencesStore();
  const cardFields = useTaskCardFields(task.projectId, task.id);
  const priorityLabel = `${t("tasks:priority.label")}: ${getPriorityLabel(task.priority ?? "")}`;

  return (
    <>
      {showPriority && (
        <TaskPriorityPopover task={task}>
          <button
            type="button"
            aria-label={priorityLabel}
            title={priorityLabel}
            className={cn(
              rowButtonClass,
              "size-5.5 justify-center [&_svg]:size-3.5",
            )}
            {...stopCardEvents}
          >
            {getPriorityIcon(task.priority ?? "")}
          </button>
        </TaskPriorityPopover>
      )}
      {showTaskNumbers && (
        <span className="w-13 shrink-0 truncate font-mono text-muted-foreground text-xs">
          {projectSlug}-{task.number}
        </span>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-foreground text-sm">{task.title}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <SubtasksChip
            task={task}
            workspaceId={workspaceId}
            className={inlineMetaClass}
          />
          {showTaskItemCounts && (
            <ChecklistChip task={task} className={inlineMetaClass} />
          )}
          {showPullRequests && (
            <TaskPullRequests
              externalLinks={task.externalLinks}
              className={cn(inlineMetaClass, "rounded-md")}
            />
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1">
        <CardFieldList fields={cardFields} max={3} />
        {showLabels && (
          <LabelChips task={task} workspaceId={workspaceId} max={2} />
        )}
      </div>

      {showDueDates && (
        <div className="flex w-24 shrink-0 justify-end">
          <DueDateChip task={task} isCompleted={isCompleted} />
        </div>
      )}

      {showAssignees && (
        <AssigneeButton
          task={task}
          workspaceId={workspaceId}
          name={assigneeName}
          image={assigneeImage}
          avatarClassName="size-5.5 text-[9px]"
        />
      )}
    </>
  );
}
