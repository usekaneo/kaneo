import type { TaskActivity } from "../api/activity.js";
import { PRIORITY_LABELS } from "../render/task-format.js";
import { statusLabel } from "../search/render-search.js";
import { plainDescription } from "../tasks/plain-description.js";

export type ActivityActor = {
  readonly id: string | null;
  readonly name: string | null;
};

export type ActivityJson = {
  readonly id: string;
  readonly type: string;
  readonly actor: ActivityActor | null;
  readonly message: string;
  readonly createdAt: string;
};

export type ActivityEntry = ActivityJson & {
  readonly summary: string;
  readonly detail: string | null;
};

export type ActivityLookups = {
  readonly members: ReadonlyMap<string, string>;
  readonly statuses: ReadonlyMap<string, string>;
  readonly now: Date;
};

type Description = { readonly summary: string; readonly detail: string | null };

const EXCERPT_LENGTH = 240;

export function excerpt(content: string | null): string | null {
  if (!content) return null;
  const flat = plainDescription(content, { width: 100_000, unicode: true })
    .lines.map((line) => line.text)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
  if (flat === "") return null;
  const characters = [...flat];
  return characters.length > EXCERPT_LENGTH
    ? `${characters
        .slice(0, EXCERPT_LENGTH - 1)
        .join("")
        .trimEnd()}…`
    : flat;
}

function eventDataOf(activity: TaskActivity): Record<string, unknown> | null {
  const data = activity.eventData;
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}

function stringField(
  data: Record<string, unknown>,
  key: string,
): string | null {
  const value = data[key];
  return typeof value === "string" && value !== "" ? value : null;
}

function formatDay(value: string, now: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

function priorityName(value: string | null): string {
  if (!value || value === "no-priority") return "No priority";
  return PRIORITY_LABELS[value] ?? value;
}

function fallback(activity: TaskActivity): Description {
  return {
    summary: excerpt(activity.content) ?? activity.type.replace(/[_-]+/gu, " "),
    detail: null,
  };
}

function describeEvent(
  activity: TaskActivity,
  data: Record<string, unknown>,
  lookups: ActivityLookups,
): Description | null {
  const status = (key: string) => {
    const slug = stringField(data, key) ?? "";
    return lookups.statuses.get(slug) ?? statusLabel(slug);
  };
  const plain = (summary: string): Description => ({ summary, detail: null });
  switch (activity.type) {
    case "status_changed":
      return plain(
        `changed status from ${status("oldStatus")} to ${status("newStatus")}`,
      );
    case "priority_changed":
      return plain(
        `changed priority from ${priorityName(stringField(data, "oldPriority"))} to ${priorityName(stringField(data, "newPriority"))}`,
      );
    case "assignee_changed": {
      if (data.isSelfAssigned === true) return plain("assigned themselves");
      const name =
        stringField(data, "newAssignee") ??
        lookups.members.get(stringField(data, "newAssigneeId") ?? "") ??
        "someone";
      return plain(`assigned ${name}`);
    }
    case "due_date_changed": {
      const next = stringField(data, "newDueDate");
      const previous = stringField(data, "oldDueDate");
      if (!next) return plain("cleared the due date");
      return plain(
        previous
          ? `changed the due date from ${formatDay(previous, lookups.now)} to ${formatDay(next, lookups.now)}`
          : `set the due date to ${formatDay(next, lookups.now)}`,
      );
    }
    case "title_changed":
      return plain(
        `renamed the task from "${stringField(data, "oldTitle") ?? ""}" to "${stringField(data, "newTitle") ?? ""}"`,
      );
    case "moved": {
      const from = stringField(data, "fromProjectName");
      const to = stringField(data, "toProjectName");
      if (from && to) return plain(`moved the task from ${from} to ${to}`);
      if (to) return plain(`moved the task from another project to ${to}`);
      return plain("moved the task");
    }
    default:
      return null;
  }
}

export function describeActivity(
  activity: TaskActivity,
  lookups: ActivityLookups,
): Description {
  switch (activity.type) {
    case "comment":
      return { summary: "commented", detail: excerpt(activity.content) };
    case "created":
    case "create":
    case "task":
      return { summary: "created the task", detail: null };
    case "unassigned":
      return { summary: "removed the assignee", detail: null };
    case "description_changed":
      return { summary: "updated the description", detail: null };
  }
  const data = eventDataOf(activity);
  return (data && describeEvent(activity, data, lookups)) ?? fallback(activity);
}

export function activityActor(
  activity: TaskActivity,
  members: ReadonlyMap<string, string>,
): ActivityActor | null {
  const external = activity.externalUserName ?? null;
  if (external) return { id: null, name: external };
  if (!activity.userId) return null;
  return {
    id: activity.userId,
    name: members.get(activity.userId) ?? null,
  };
}

export function toActivityEntry(
  activity: TaskActivity,
  lookups: ActivityLookups,
): ActivityEntry {
  const { summary, detail } = describeActivity(activity, lookups);
  return {
    id: activity.id,
    type: activity.type,
    actor: activityActor(activity, lookups.members),
    message: detail ? `${summary}: ${detail}` : summary,
    createdAt: activity.createdAt,
    summary,
    detail,
  };
}

export function toActivityJson(entry: ActivityEntry): ActivityJson {
  return {
    id: entry.id,
    type: entry.type,
    actor: entry.actor,
    message: entry.message,
    createdAt: entry.createdAt,
  };
}
