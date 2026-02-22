export type DueDateStatus =
  | "overdue"
  | "due-soon"
  | "far-future"
  | "no-due-date";

export function getDueDateStatus(dueDate: string | null): DueDateStatus {
  if (!dueDate) return "no-due-date";

  const now = new Date();
  const due = new Date(dueDate);
  const diffInDays = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffInDays < 0) return "overdue";
  if (diffInDays <= 3) return "due-soon";
  return "far-future";
}

export const dueDateStatusColors = {
  overdue: "bg-destructive/10 text-destructive-foreground",
  "due-soon": "bg-warning/10 text-warning-foreground",
  "far-future": "bg-muted/50 text-muted-foreground",
  "no-due-date": "bg-muted/50 text-muted-foreground",
} as const;

export const dueDateStatusIcons = {
  overdue: "calendar-x",
  "due-soon": "calendar-clock",
  "far-future": "calendar",
  "no-due-date": "calendar",
} as const;
