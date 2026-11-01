import { AssigneeAvatar } from "@/components/task/properties/assignee-avatar";
import { cn } from "@/lib/cn";
import { splitVisibleAssignees } from "@/lib/task-assignees";
import type { TaskAssignee } from "@/types/task";

type AssigneeStackProps = {
  assignees: readonly TaskAssignee[];
  max?: number;
  avatarClassName?: string;
  avatarFallbackClassName?: string;
  ringClassName?: string;
};

// A compact row of overlapping avatars with a "+N" chip for the rest.
export function AssigneeStack({
  assignees,
  max = 3,
  avatarClassName,
  avatarFallbackClassName,
  ringClassName = "ring-board-card",
}: AssigneeStackProps) {
  const { shown, overflow } = splitVisibleAssignees(assignees, max);

  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((assignee) => (
        <AssigneeAvatar
          key={assignee.id}
          name={assignee.name}
          image={assignee.image}
          assigned
          className={cn("ring-2", ringClassName, avatarClassName)}
          fallbackClassName={avatarFallbackClassName}
        />
      ))}
      {overflow > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4.5 shrink-0 items-center justify-center rounded-full border border-avatar-border bg-avatar font-semibold text-[8px] text-avatar-foreground tabular-nums ring-2",
            ringClassName,
            avatarClassName,
          )}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
