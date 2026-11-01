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
};

// The assignee shown in the task panel: one person as before, or a small
// avatar stack with the first name and a "+N" count.
export function AssigneeValue({
  task,
  name,
  image,
  labelClassName,
}: AssigneeValueProps) {
  const { t } = useTranslation();
  const assignees = task.assignees ?? [];

  if (assignees.length > 1) {
    const [first] = assignees;
    return (
      <>
        <AssigneeStack assignees={assignees} ringClassName="ring-background" />
        <span
          className={cn("truncate", labelClassName)}
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
          "truncate",
          !task.userId && "text-muted-foreground",
          labelClassName,
        )}
      >
        {name || t("tasks:popover.assignee.unassigned")}
      </span>
    </>
  );
}
