import type {
  BoardColumnIcon,
  TaskCardDueStatus,
  TaskCardPriority,
} from "@kaneo/email";

const DAY_MS = 24 * 60 * 60 * 1000;

const labelColors: Record<string, string> = {
  gray: "#79716B",
  "dark-gray": "#62748E",
  purple: "#8E51FF",
  teal: "#009966",
  green: "#00A63E",
  yellow: "#E17100",
  orange: "#F54900",
  pink: "#EC003F",
  red: "#E7000B",
};

const FALLBACK_LABEL_COLOR = "#A1A1A1";
const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;

const columnIcons: Record<string, BoardColumnIcon> = {
  Circle: "circle",
  CircleDot: "circle-dot",
  CircleDashed: "circle-dashed",
  Search: "search",
  CheckCircle2: "check-circle",
  Archive: "archive",
};

const defaultColumnIcons: Record<string, BoardColumnIcon> = {
  "to-do": "circle",
  "in-progress": "circle-dot",
  "in-review": "search",
  done: "check-circle",
  archived: "archive",
  planned: "circle-dashed",
};

const priorities = new Set<TaskCardPriority>([
  "urgent",
  "high",
  "medium",
  "low",
]);

export function resolveLabelColor(value: string): string {
  return (
    labelColors[value] ?? (HEX_COLOR.test(value) ? value : FALLBACK_LABEL_COLOR)
  );
}

export function resolveColumnIcon(column: {
  slug: string;
  icon: string | null;
  isFinal: boolean;
}): BoardColumnIcon {
  if (column.icon) {
    return (
      columnIcons[column.icon] ?? (column.isFinal ? "check-circle" : "circle")
    );
  }
  return (
    defaultColumnIcons[column.slug] ??
    (column.isFinal ? "check-circle" : "circle")
  );
}

export function resolvePriority(
  priority: string | null,
): TaskCardPriority | undefined {
  return priorities.has(priority as TaskCardPriority)
    ? (priority as TaskCardPriority)
    : undefined;
}

export function resolveDueStatus(
  dueDate: Date,
  isCompleted: boolean,
  now = new Date(),
): TaskCardDueStatus {
  if (isCompleted) return "far-future";

  const days = Math.ceil((dueDate.getTime() - now.getTime()) / DAY_MS);
  if (days < 0) return "overdue";
  if (days <= 3) return "due-soon";
  return "far-future";
}

export function getInitials(value: string | null | undefined) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (parts.length === 0) return undefined;
  if (parts.length === 1) {
    return Array.from(parts[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("");
  }

  return parts
    .slice(0, 2)
    .map((part) => Array.from(part.toUpperCase())[0])
    .join("");
}
