import { Bug, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";

type TaskTypeBadgeProps = {
  task: Task;
  className?: string;
};

// Read-only type indicator. The type is set at creation (bugs default to the
// active sprint, everything else to the backlog) and is not editable after.
// A span, not a button: it announces itself as plain text and never pretends
// to be an interactive control.
export default function TaskTypeBadge({ task, className }: TaskTypeBadgeProps) {
  const { t } = useTranslation();
  const isBug = task.type === "bug";

  return (
    <span
      title={t("tasks:type.label")}
      className={cn("inline-flex h-7 items-center gap-1.5 px-1.5", className)}
    >
      {isBug ? (
        <Bug className="h-3.5 w-3.5 shrink-0 text-destructive" />
      ) : (
        <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="text-xs font-semibold truncate">
        {isBug ? t("tasks:type.bug") : t("tasks:type.task")}
      </span>
    </span>
  );
}
