import { Check, Rocket } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskSprint } from "@/hooks/mutations/sprint/use-update-task-sprint";
import { useGetSprints } from "@/hooks/queries/sprint/use-get-sprints";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskSprintPopoverProps = {
  task: Task;
  className?: string;
};

// Assigns a task to the current or an upcoming sprint, or to the backlog.
// A task inside a closed sprint is read-only: it stays there as history.
export default function TaskSprintPopover({
  task,
  className,
}: TaskSprintPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: sprints = [] } = useGetSprints(task.projectId);
  const { mutateAsync: updateTaskSprint } = useUpdateTaskSprint();
  const { canUpdateTasks } = useWorkspacePermission();

  const currentSprint = sprints.find((sprint) => sprint.id === task.sprintId);
  const assignableSprints = sprints.filter(
    (sprint) => sprint.status === "active" || sprint.status === "future",
  );
  const isLocked = currentSprint?.status === "closed";
  const canEdit = canUpdateTasks() && !isLocked;

  const handleSelect = useCallback(
    async (sprintId: string | null) => {
      try {
        await updateTaskSprint({
          taskId: task.id,
          projectId: task.projectId,
          sprintId,
        });
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:sprints.error", {
                defaultValue: "Sprint action failed",
              }),
        );
      }
    },
    [t, task.id, task.projectId, updateTaskSprint],
  );

  const label = currentSprint?.name ?? t("tasks:sprints.backlog");

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      className={`justify-start h-7 px-1.5 gap-1.5 ${className ?? ""}`}
      disabled={isLocked}
      title={isLocked ? t("tasks:sprints.closedLocked") : undefined}
    >
      <Rocket className="h-3.5 w-3.5 text-muted-foreground" />
      <span
        className={`text-xs font-semibold truncate ${currentSprint ? "" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </Button>
  );

  if (!canEdit) {
    return trigger;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <button
          type="button"
          onClick={() => handleSelect(null)}
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-accent"
        >
          <span>{t("tasks:sprints.backlog")}</span>
          {!task.sprintId && <Check className="h-3 w-3" />}
        </button>
        {assignableSprints.map((sprint) => (
          <button
            key={sprint.id}
            type="button"
            onClick={() => handleSelect(sprint.id)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-accent"
          >
            <span className="truncate">
              {sprint.name}
              {sprint.status === "active"
                ? " · " + t("tasks:sprints.activeBadge")
                : ""}
            </span>
            {task.sprintId === sprint.id && <Check className="h-3 w-3" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
