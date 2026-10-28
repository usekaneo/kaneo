import { useTranslation } from "react-i18next";
import TaskPriorityPopover from "@/components/task/task-priority-popover";
import { cn } from "@/lib/cn";
import { getPriorityLabel } from "@/lib/i18n/domain";
import type Task from "@/types/task";
import { PriorityGlyph } from "./priority-glyph";
import { stopCardEvents } from "./stop-card-events";
import { taskChipClass } from "./task-chip-class";

export function PriorityChip({ task }: { task: Task }) {
  const { t } = useTranslation();
  const label = `${t("tasks:priority.label")}: ${getPriorityLabel(task.priority ?? "")}`;

  return (
    <TaskPriorityPopover task={task}>
      <button
        type="button"
        aria-label={label}
        title={label}
        className={cn(
          taskChipClass,
          "w-5.5 justify-center px-0 [&_svg]:size-3.5",
        )}
        {...stopCardEvents}
      >
        <PriorityGlyph priority={task.priority} />
      </button>
    </TaskPriorityPopover>
  );
}
