import { useTranslation } from "react-i18next";
import type Task from "@/types/task";
import { AssigneeAvatars } from "../assignee-avatars";
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
  const people = tasks[0]?.assignees;
  const assigned = Boolean(people?.length || tasks[0]?.userId);

  return (
    <SubtaskAssigneePopover tasks={tasks} workspaceId={workspaceId}>
      <button
        type="button"
        aria-label={
          people?.length
            ? people.map((person) => person.name).join(", ")
            : assigned && name
              ? name
              : t("tasks:popover.assignee.unassigned")
        }
        className="relative flex shrink-0 rounded-full outline-none before:absolute before:-inset-1 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AssigneeAvatars
          task={tasks[0] ?? { userId: null }}
          name={name}
          image={image}
        />
      </button>
    </SubtaskAssigneePopover>
  );
}
