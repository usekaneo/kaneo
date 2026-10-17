import type { Json, Notification } from "./api/types";
import { formatDate } from "./format";
import { i18n } from "./i18n";
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
      return i18n.t("mobile:notificationText.activity.created");
    case "comment":
      return i18n.t("mobile:notificationText.activity.commented", {
        text: toPlainText(content).slice(0, 240),
      });
    case "status_changed":
      return i18n.t("mobile:notificationText.activity.statusChanged", {
        from: statusName(
          str(data, "oldStatus"),
          str(data, "oldStatusName"),
          statusNames,
        ),
        to: statusName(
          str(data, "newStatus"),
          str(data, "newStatusName"),
          statusNames,
        ),
      });
    case "priority_changed":
      return i18n.t("mobile:notificationText.activity.priorityChanged", {
        from: priorityLabel(str(data, "oldPriority")),
        to: priorityLabel(str(data, "newPriority")),
      });
    case "assignee_changed": {
      const assignee = str(data, "newAssignee");
      if (!assignee)
        return i18n.t("mobile:notificationText.activity.assigneeChanged");
      return str(data, "isSelfAssigned") === "true"
        ? i18n.t("mobile:notificationText.activity.selfAssigned")
        : i18n.t("mobile:notificationText.activity.assignedTo", { assignee });
    }
    case "unassigned":
      return i18n.t("mobile:notificationText.activity.unassigned");
    case "due_date_changed": {
      const due = str(data, "newDueDate");
      return due
        ? i18n.t("mobile:notificationText.activity.dueDateSet", {
            date: formatDate(due),
          })
        : i18n.t("mobile:notificationText.activity.dueDateRemoved");
    }
    case "title_changed": {
      const title = str(data, "newTitle");
      return title
        ? i18n.t("mobile:notificationText.activity.renamed", { title })
        : i18n.t("mobile:notificationText.activity.titleChanged");
    }
    case "description_changed":
      return i18n.t("mobile:notificationText.activity.descriptionChanged");
    case "task":
      return content
        ? toPlainText(content)
        : i18n.t("mobile:notificationText.activity.taskUpdated");
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
  const actor =
    str(data, "userName") ?? str(data, "authorName") ?? str(data, "actorName");
  switch (n.type) {
    case "task_created":
      return {
        title: i18n.t("mobile:notificationText.taskCreated"),
        body: taskTitle,
      };
    case "task_assignee_changed":
      return {
        title: actor
          ? i18n.t("mobile:notificationText.assignedByActor", { actor })
          : taskTitle
            ? i18n.t("mobile:notificationText.assignedToTask", {
                title: taskTitle,
              })
            : i18n.t("mobile:notificationText.assignedToUntitled"),
        body: taskTitle,
      };
    case "task_status_changed": {
      const from = str(data, "oldStatusName") ?? str(data, "oldStatus");
      const to = str(data, "newStatusName") ?? str(data, "newStatus");
      return {
        title: taskTitle
          ? i18n.t("mobile:notificationText.statusChangedOnTask", {
              title: taskTitle,
            })
          : i18n.t("mobile:notificationText.statusChangedOnUntitled"),
        body:
          from && to
            ? i18n.t("mobile:notificationText.statusTransition", { from, to })
            : null,
      };
    }
    case "task_comment":
      return {
        title: actor
          ? i18n.t("mobile:notificationText.commentedByActor", { actor })
          : i18n.t("mobile:notificationText.newComment"),
        body:
          toPlainText(
            str(data, "comment") ?? str(data, "excerpt") ?? n.content,
          ) || taskTitle,
      };
    case "task_mention":
      return {
        title: actor
          ? i18n.t("mobile:notificationText.mentionedByActor", { actor })
          : i18n.t("mobile:notificationText.mentioned"),
        body:
          toPlainText(
            str(data, "comment") ?? str(data, "excerpt") ?? n.content,
          ) || taskTitle,
      };
    case "time_entry_created":
      return {
        title: taskTitle
          ? i18n.t("mobile:notificationText.timeLoggedOnTask", {
              title: taskTitle,
            })
          : i18n.t("mobile:notificationText.timeLoggedOnUntitled"),
        body: null,
      };
    case "workspace_created":
      return {
        title: i18n.t("mobile:notificationText.workspaceCreated", {
          name: str(data, "workspaceName") ?? "",
        }),
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
