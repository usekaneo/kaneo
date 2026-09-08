import { ListTree, SquareCheck } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { getTaskItemStats } from "@/lib/get-task-item-stats";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";

export function TaskProgressBadges({
  task,
}: {
  task: Pick<Task, "description" | "subtaskCounts">;
}) {
  const { t } = useTranslation();
  const { showTaskItemCounts } = useUserPreferencesStore();
  const checklist = useMemo(
    () => getTaskItemStats(task.description),
    [task.description],
  );
  const counters = [
    {
      kind: "subtasks",
      counts: task.subtaskCounts,
      Icon: ListTree,
      label: t("tasks:subtasks.progress", {
        completed: task.subtaskCounts?.completed ?? 0,
        total: task.subtaskCounts?.total ?? 0,
      }),
    },
    {
      kind: "checklist",
      counts: showTaskItemCounts ? checklist : undefined,
      Icon: SquareCheck,
      label: t("tasks:checklistProgress", {
        completed: checklist.completed,
        total: checklist.total,
      }),
    },
  ];

  return counters.map(({ kind, counts, Icon, label }) =>
    counts && counts.total > 0 ? (
      <Tooltip key={kind}>
        <TooltipTrigger
          aria-label={label}
          className={cn(
            "inline-flex h-5.5 shrink-0 cursor-inherit items-center gap-1 rounded border border-border/70 bg-muted/50 px-2 py-1 text-[10px] font-medium tabular-nums text-muted-foreground",
            counts.completed === counts.total &&
              "border-success/20 bg-success/10 text-success-foreground",
          )}
        >
          <Icon className="size-3" aria-hidden="true" />
          {counts.completed}/{counts.total}
        </TooltipTrigger>
        <TooltipPopup>{label}</TooltipPopup>
      </Tooltip>
    ) : null,
  );
}
