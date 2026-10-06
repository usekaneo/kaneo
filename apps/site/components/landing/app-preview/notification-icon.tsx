import {
  AtSign,
  Bell,
  CalendarClock,
  CalendarX,
  History,
  type LucideIcon,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = {
  task_mention: AtSign,
  task_comment: MessageSquare,
  task_assignee_changed: UserRound,
  task_status_changed: History,
  due_date_reminder: CalendarClock,
  task_overdue: CalendarX,
};

export function NotificationIcon({ type }: { type: string }) {
  const Icon = icons[type] ?? Bell;

  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        type === "task_overdue"
          ? "bg-destructive/10 text-destructive-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
    </span>
  );
}
