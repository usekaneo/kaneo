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
  overdue: "text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20",
  "due-soon":
    "text-orange-500 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/20",
  "far-future":
    "text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/30",
  "no-due-date":
    "text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/30",
} as const;

export const dueDateStatusIcons = {
  overdue: "calendar-x",
  "due-soon": "calendar-clock",
  "far-future": "calendar",
  "no-due-date": "calendar",
} as const;
