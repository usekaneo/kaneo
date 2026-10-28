import { useTranslation } from "react-i18next";
import TaskAssigneePopover from "@/components/task/task-assignee-popover";
import { AssigneeAvatar } from "@/components/task/properties/assignee-avatar";
import type Task from "@/types/task";
import { stopCardEvents } from "./stop-card-events";

type AssigneeButtonProps = {
  task: Task;
  workspaceId: string;
  name: string | null | undefined;
  image: string | null | undefined;
  avatarClassName?: string;
  avatarFallbackClassName?: string;
};

export function AssigneeButton({
  task,
  workspaceId,
  name,
  image,
  avatarClassName,
  avatarFallbackClassName,
}: AssigneeButtonProps) {
  const { t } = useTranslation();
  const label = task.userId
    ? name || t("tasks:assignee.label")
    : t("tasks:assignee.unassigned");

  return (
    <TaskAssigneePopover task={task} workspaceId={workspaceId}>
      <button
        type="button"
        aria-label={label}
        title={label}
        className="relative flex shrink-0 cursor-pointer rounded-full outline-none ring-offset-1 ring-offset-board-card transition-shadow before:absolute before:-inset-1 hover:ring-2 hover:ring-chip-border-hover focus-visible:ring-[3px] focus-visible:ring-board-card-ring data-popup-open:ring-2 data-popup-open:ring-chip-border-open"
        {...stopCardEvents}
      >
        <AssigneeAvatar
          name={name}
          image={image}
          assigned={Boolean(task.userId)}
          className={avatarClassName}
          fallbackClassName={avatarFallbackClassName}
        />
      </button>
    </TaskAssigneePopover>
  );
}
