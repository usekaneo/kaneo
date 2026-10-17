import type { RawNotification } from "../api/notifications.js";

export type NotificationView = {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly message: string | null;
  readonly read: boolean;
  readonly createdAt: string;
  readonly workspaceId: string | null;
  readonly projectId: string | null;
  readonly taskId: string | null;
  readonly taskTitle: string | null;
};

type EventData = Readonly<Record<string, unknown>>;

function record(value: unknown): EventData | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as EventData)
    : null;
}

function field(data: EventData | null, key: string): string | null {
  const value = data?.[key];
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function statusLabel(slug: string | null): string {
  if (!slug) return "unknown";
  const words = slug.replace(/[-_]+/gu, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function leadTime(data: EventData): string {
  const minutes = Number(data.leadTimeMinutes ?? 1440);
  const plural = (count: number, unit: string) =>
    `${count} ${unit}${count === 1 ? "" : "s"}`;
  if (minutes % 1440 === 0) return plural(minutes / 1440, "day");
  if (minutes % 60 === 0) return plural(minutes / 60, "hour");
  return plural(minutes, "minute");
}

function describe(
  raw: RawNotification,
  data: EventData,
): { readonly title: string; readonly message: string | null } | null {
  const task = field(data, "taskTitle");
  const named = task ?? "a task";
  switch (raw.type) {
    case "task_created":
      return { title: "New task created", message: named };
    case "workspace_created":
      return {
        title: "Workspace created",
        message: `Your workspace "${field(data, "workspaceName") ?? ""}" has been created`,
      };
    case "task_status_changed":
      return {
        title: "Task status changed",
        message: `"${named}" moved from ${statusLabel(field(data, "oldStatus"))} to ${statusLabel(field(data, "newStatus"))}`,
      };
    case "task_assignee_changed":
      return { title: "Task assigned to you", message: named };
    case "task_mention": {
      const who = field(data, "mentionerName") ?? "Someone";
      return { title: `${who} mentioned you`, message: named };
    }
    case "task_comment": {
      const who = field(data, "commenterName") ?? "Someone";
      const preview = field(data, "commentPreview");
      return {
        title: `${who} commented on your task`,
        message: preview ? `${named}: ${preview}` : named,
      };
    }
    case "due_date_reminder":
      return {
        title: "Task due soon",
        message: `${named} is due in ${leadTime(data)}`,
      };
    case "task_overdue":
      return {
        title: "Task overdue",
        message: `${named} is past its due date`,
      };
    case "time_entry_created":
      return { title: "Time tracking started", message: named };
    default:
      return null;
  }
}

function singleLine(value: string | null): string | null {
  if (value === null) return null;
  const line = value.replace(/\s+/gu, " ").trim();
  return line === "" ? null : line;
}

export function normalizeNotification(raw: RawNotification): NotificationView {
  const data = record(raw.eventData);
  const described = data ? describe(raw, data) : null;
  const isTask = raw.resourceType === "task" && raw.resourceId !== null;
  return {
    id: raw.id,
    type: raw.type,
    title: singleLine(described?.title ?? raw.title) ?? statusLabel(raw.type),
    message: singleLine(described?.message ?? raw.content),
    read: raw.isRead === true,
    createdAt: raw.createdAt,
    workspaceId:
      field(data, "workspaceId") ??
      (raw.resourceType === "workspace" ? raw.resourceId : null),
    projectId: field(data, "projectId"),
    taskId: isTask ? raw.resourceId : null,
    taskTitle: isTask ? field(data, "taskTitle") : null,
  };
}
