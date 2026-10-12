import type { Segment } from "./cell.js";
import type { Style } from "./theme.js";
import type { Ui } from "./ui.js";

export function ticketId(
  projectSlug: string,
  number: number | null,
): string | null {
  return number === null ? null : `${projectSlug.toUpperCase()}-${number}`;
}

export function statusStyle(ui: Ui, slug: string, isFinal: boolean): Style {
  if (isFinal || slug === "done") return ui.theme.done;
  if (slug === "in-progress") return ui.theme.progress;
  if (slug === "in-review") return ui.theme.review;
  if (slug === "to-do" || slug === "todo" || slug === "backlog")
    return ui.theme.todo;
  return ui.theme.muted;
}

export function statusDot(ui: Ui, slug: string, isFinal: boolean): Segment {
  return { text: ui.glyphs.dot, style: statusStyle(ui, slug, isFinal) };
}

export const PRIORITY_LABELS: Readonly<Record<string, string>> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function prioritySegments(ui: Ui, priority: string): Segment[] {
  const label = PRIORITY_LABELS[priority];
  if (!label) return [];
  const { glyphs, theme } = ui;
  const style =
    priority === "urgent"
      ? theme.danger
      : priority === "high" || priority === "medium"
        ? theme.warning
        : theme.info;
  const glyph = glyphs.priority[priority as keyof typeof glyphs.priority];
  return [
    { text: `${glyph} `, style },
    { text: label, style },
  ];
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

export type DueState = "overdue" | "today" | "soon" | "later";

export function dueState(due: Date, now: Date): DueState {
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 2) return "soon";
  return "later";
}

export function formatDue(due: Date, now: Date): string {
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) {
    return due.toLocaleDateString("en-US", { weekday: "short" });
  }
  const sameYear = due.getFullYear() === now.getFullYear();
  return due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function dueSegments(
  ui: Ui,
  dueDate: string | null,
  done: boolean,
  now: Date,
): Segment[] {
  if (!dueDate) return [];
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return [];
  const state = dueState(due, now);
  const style = done
    ? ui.theme.muted
    : state === "overdue"
      ? ui.theme.danger
      : state === "today"
        ? ui.theme.warning
        : undefined;
  const prefix = ui.glyphs.due ? `${ui.glyphs.due} ` : "";
  return [{ text: `${prefix}${formatDue(due, now)}`, style }];
}
