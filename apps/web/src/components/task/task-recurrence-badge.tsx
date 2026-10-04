import { Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRecurrence } from "@/lib/format-recurrence";
import type Task from "@/types/task";

export function TaskRecurrenceBadge({
  task,
  asText = false,
}: {
  task: Pick<Task, "recurrence">;
  asText?: boolean;
}) {
  const { t, i18n } = useTranslation();
  if (!task.recurrence) return null;
  const label = formatRecurrence(t, task.recurrence, i18n.language);
  const className =
    "inline-flex shrink-0 cursor-[inherit] items-center text-muted-foreground";

  // Inside another button, such as the due date trigger, stay plain text.
  if (asText) {
    return (
      <span className={className} title={label}>
        <Repeat className="size-3" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger aria-label={label} className={className}>
        <Repeat className="size-3" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
