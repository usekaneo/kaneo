import { useTranslation } from "react-i18next";
import TaskLabelsPopover from "@/components/task/task-labels-popover";
import { cn } from "@/lib/cn";
import { localeCompareSort } from "@/lib/format";
import { resolveLabelColor } from "@/lib/label-color";
import type Task from "@/types/task";
import { stopCardEvents } from "./stop-card-events";
import { taskChipClass } from "./task-chip-class";

type LabelChipsProps = {
  task: Task;
  workspaceId: string;
  max?: number;
};

export function LabelChips({ task, workspaceId, max = 2 }: LabelChipsProps) {
  const { t, i18n } = useTranslation();
  const labels = task.labels ?? [];
  if (labels.length === 0) return null;

  const locale = i18n.resolvedLanguage || i18n.language;
  const sorted = [...labels].sort((a, b) =>
    localeCompareSort(a.name, b.name, locale),
  );
  const visible = sorted.slice(0, max);
  const hidden = sorted.length - visible.length;

  return (
    <TaskLabelsPopover task={task} workspaceId={workspaceId}>
      <button
        type="button"
        aria-label={t("tasks:popover.labels.editLabels")}
        title={sorted.map((label) => label.name).join(", ")}
        className="group/labels inline-flex min-w-0 max-w-full cursor-pointer flex-wrap items-center gap-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-board-card-ring"
        {...stopCardEvents}
      >
        {visible.map((label) => (
          <span
            key={label.id}
            className={cn(
              taskChipClass,
              "max-w-36 gap-1.5 group-hover/labels:border-chip-border-hover group-hover/labels:bg-chip-hover group-data-popup-open/labels:border-chip-border-open group-data-popup-open/labels:bg-chip-open",
            )}
          >
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: resolveLabelColor(label.color) }}
            />
            <span className="truncate">{label.name}</span>
          </span>
        ))}
        {hidden > 0 && (
          <span
            className={cn(
              taskChipClass,
              "font-medium text-chip-muted group-hover/labels:border-chip-border-hover group-hover/labels:bg-chip-hover group-data-popup-open/labels:border-chip-border-open group-data-popup-open/labels:bg-chip-open",
            )}
          >
            +{hidden}
          </span>
        )}
      </button>
    </TaskLabelsPopover>
  );
}
