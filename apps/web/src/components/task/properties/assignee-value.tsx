import { useTranslation } from "react-i18next";
import { AssigneeStack } from "@/components/task-chips/assignee-stack";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";
import { AssigneeAvatar } from "./assignee-avatar";

type AssigneeValueProps = {
  task: Task;
  name: string | null | undefined;
  image: string | null | undefined;
  labelClassName?: string;
  /** Let a long name wrap to two lines instead of being cut off. */
  wrap?: boolean;
};

// The assignee shown in the task panel: one person as before, or a small
// avatar stack with the first name and a "+N" count.
export function AssigneeValue({
  task,
  name,
  image,
  labelClassName,
  wrap = false,
}: AssigneeValueProps) {
  const { t } = useTranslation();
  const assignees = task.assignees ?? [];
  const textClass = wrap ? "line-clamp-2 break-words" : "truncate";

  if (assignees.length > 1) {
    const [first] = assignees;
    return (
      <>
        <AssigneeStack assignees={assignees} ringClassName="ring-background" />
        <span
          className={cn(textClass, labelClassName)}
          title={assignees.map((assignee) => assignee.name).join(", ")}
        >
          {first?.name} +{assignees.length - 1}
        </span>
      </>
    );
  }

  return (
    <>
      <AssigneeAvatar
        name={name}
        image={image}
        assigned={Boolean(task.userId)}
      />
      <span
        className={cn(
          textClass,
          !task.userId && "text-muted-foreground",
          labelClassName,
        )}
      >
        {name || t("tasks:popover.assignee.unassigned")}
      </span>
    </>
  );
}
