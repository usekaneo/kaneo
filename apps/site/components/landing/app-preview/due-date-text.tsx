import { differenceInCalendarDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import messages from "../../../../../i18n/en-US.json";

const due = messages.workspace.myWork.due;

// Same wording as apps/web's my-work/due-date-text.
export function DueDateText({
  dueDate,
  className,
}: {
  dueDate: string | null;
  className?: string;
}) {
  if (!dueDate) return null;

  const days = differenceInCalendarDays(new Date(dueDate), new Date());
  const text =
    days === 0
      ? due.today
      : days === 1
        ? due.tomorrow
        : days > 1 && days <= 6
          ? format(new Date(dueDate), "EEEE")
          : format(new Date(dueDate), "MMM d");

  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        days < 0
          ? "font-medium text-destructive-foreground"
          : days === 0
            ? "font-medium text-foreground"
            : "text-muted-foreground",
        className,
      )}
    >
      {text}
    </span>
  );
}
