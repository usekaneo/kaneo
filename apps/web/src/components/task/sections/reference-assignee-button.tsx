import { useTranslation } from "react-i18next";
import type Task from "@/types/task";
import { AssigneeAvatar } from "../properties/assignee-avatar";
import SubtaskAssigneePopover from "../subtask-assignee-popover";

type ReferenceAssigneeButtonProps = {
  tasks: Task[];
  workspaceId: string;
  name: string | null | undefined;
  image: string | null | undefined;
};

export function ReferenceAssigneeButton({
  tasks,
  workspaceId,
  name,
  image,
}: ReferenceAssigneeButtonProps) {
  const { t } = useTranslation();
  const assigned = Boolean(tasks[0]?.userId);

  return (
    <SubtaskAssigneePopover tasks={tasks} workspaceId={workspaceId}>
      <button
        type="button"
        aria-label={
          assigned && name ? name : t("tasks:popover.assignee.unassigned")
        }
        className="relative flex shrink-0 rounded-full outline-none before:absolute before:-inset-1 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AssigneeAvatar name={name} image={image} assigned={assigned} />
      </button>
    </SubtaskAssigneePopover>
  );
}
