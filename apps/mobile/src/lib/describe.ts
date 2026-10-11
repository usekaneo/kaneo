import type { Json, Notification } from "./api/types";
import { formatDate } from "./format";
import { toPlainText } from "./markdown";
import { priorityLabel } from "./style";

function str(data: Json | undefined, key: string): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = (data as Record<string, Json>)[key];
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : String(value);
}

export function field(data: Json | undefined, key: string) {
  return str(data, key);
}

function statusName(
  slug: string | null,
  name: string | null,
  names: Record<string, string>,
) {
  return (
    name ??
    (slug ? names[slug] : undefined) ??
    (slug ? slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) : "?")
  );
}

/** Sentence (without the actor) for a task activity entry, e.g. "moved this from To do to Done". */
export function describeActivity(
  type: string,
  data: Json | undefined,
  content?: string | null,
  statusNames: Record<string, string> = {},
): string {
  switch (type) {
    case "create":
    case "created":
      return "created the task";
    case "comment":
      return `commented: ${toPlainText(content).slice(0, 240)}`;
    case "status_changed":
      return `moved this from ${statusName(str(data, "oldStatus"), str(data, "oldStatusName"), statusNames)} to ${statusName(
        str(data, "newStatus"),
        str(data, "newStatusName"),
        statusNames,
      )}`;
    case "priority_changed":
      return `changed priority from ${priorityLabel(str(data, "oldPriority"))} to ${priorityLabel(str(data, "newPriority"))}`;
    case "assignee_changed": {
      const assignee = str(data, "newAssignee");
      if (!assignee) return "changed the assignee";
      return str(data, "isSelfAssigned") === "true"
        ? "self-assigned this"
        : `assigned this to ${assignee}`;
    }
    case "unassigned":
      return "removed the assignee";
    case "due_date_changed": {
      const due = str(data, "newDueDate");
      return due
        ? `set the due date to ${formatDate(due)}`
        : "removed the due date";
    }
    case "title_changed": {
      const title = str(data, "newTitle");
      return title ? `renamed this to “${title}”` : "changed the title";
    }
    case "description_changed":
      return "updated the description";
    case "task":
      return content ? toPlainText(content) : "updated the task";
    default:
      return (
        (content ? toPlainText(content).slice(0, 240) : "") ||
        type.replace(/_/g, " ")
      );
  }
}

export type NotificationText = { title: string; body: string | null };

export function describeNotification(n: Notification): NotificationText {
  const data = n.eventData;
  const taskTitle = str(data, "taskTitle");
  const task = taskTitle ? `“${taskTitle}”` : "a task";
  const actor =
    str(data, "userName") ?? str(data, "authorName") ?? str(data, "actorName");
  switch (n.type) {
    case "task_created":
      return { title: "New task assigned to you", body: taskTitle };
    case "task_assignee_changed":
      return {
        title: actor
          ? `${actor} assigned you a task`
          : `You were assigned to ${task}`,
        body: taskTitle,
      };
    case "task_status_changed": {
      const from = str(data, "oldStatusName") ?? str(data, "oldStatus");
      const to = str(data, "newStatusName") ?? str(data, "newStatus");
      return {
        title: `Status changed on ${task}`,
        body: from && to ? `${from} to ${to}` : null,
      };
    }
    case "task_comment":
      return {
        title: actor ? `${actor} commented` : "New comment",
        body:
          toPlainText(
            str(data, "comment") ?? str(data, "excerpt") ?? n.content,
          ) || taskTitle,
      };
    case "task_mention":
      return {
        title: actor ? `${actor} mentioned you` : "You were mentioned",
        body:
          toPlainText(
            str(data, "comment") ?? str(data, "excerpt") ?? n.content,
          ) || taskTitle,
      };
    case "time_entry_created":
      return { title: `Time logged on ${task}`, body: null };
    case "workspace_created":
      return {
        title: `Workspace “${str(data, "workspaceName") ?? ""}” created`,
        body: null,
      };
    default:
      return {
        title:
          n.title ??
          n.type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
        body: n.content ? toPlainText(n.content) : null,
      };
  }
}

export function notificationActor(n: Notification): string | null {
  return (
    str(n.eventData, "userName") ??
    str(n.eventData, "authorName") ??
    str(n.eventData, "actorName")
  );
}

export function notificationWorkspaceId(n: Notification): string | null {
  return str(n.eventData, "workspaceId");
}

/** Better Auth may return organization metadata as an object or as a JSON string. */
export function workspaceDescription(metadata: Json | undefined): string {
  let m: Json | undefined = metadata;
  if (typeof m === "string") {
    try {
      m = JSON.parse(m) as Json;
    } catch {
      return "";
    }
  }
  if (
    m &&
    typeof m === "object" &&
    !Array.isArray(m) &&
    typeof m.description === "string"
  )
    return m.description;
  return "";
}
