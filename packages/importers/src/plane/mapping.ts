import { toIsoDate } from "../markdown.js";
import type {
  ImportedColumn,
  ImportedComment,
  ImportedLabel,
  ImportedPerson,
  ImportedPriority,
  ImportedProject,
  ImportedRelation,
  ImportedTask,
} from "../types.js";
import type {
  PlaneComment,
  PlaneLabel,
  PlaneMember,
  PlaneProject,
  PlaneState,
  PlaneUser,
  PlaneWorkItem,
} from "./client.js";
import { createHtmlToMarkdown, type HtmlToMarkdown } from "./html.js";

export const STATE_GROUP_ORDER = [
  "triage",
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
];

export const FINAL_STATE_GROUPS = new Set(["completed", "cancelled"]);

export const FALLBACK_LABEL_COLOR = "#6b7280";

export const MEMBERS_WARNING =
  "Plane did not share the project member list with this token, so some assignee emails may be missing.";

const PRIORITIES: Record<string, ImportedPriority> = {
  urgent: "urgent",
  high: "high",
  medium: "medium",
  low: "low",
  none: "no-priority",
};

export type PlaneProjectData = {
  project: PlaneProject;
  states: PlaneState[];
  labels: PlaneLabel[];
  members: PlaneMember[] | null;
  workItems: PlaneWorkItem[];
  comments: Map<string, PlaneComment[]>;
};

export function orderStates(states: PlaneState[]): PlaneState[] {
  return [...states].sort(
    (a, b) =>
      groupRank(a.group) - groupRank(b.group) ||
      (a.sequence ?? 0) - (b.sequence ?? 0),
  );
}

const BACKLOG_STATE_GROUPS = new Set(["triage", "backlog"]);

export function mapColumns(states: PlaneState[]): ImportedColumn[] {
  return orderStates(states)
    .filter(
      (state) => !BACKLOG_STATE_GROUPS.has(state.group?.toLowerCase() ?? ""),
    )
    .map((state) => ({
      key: state.id,
      name: state.name?.trim() || "Untitled",
      isFinal: FINAL_STATE_GROUPS.has(state.group?.toLowerCase() ?? ""),
    }));
}

export function mapPriority(
  value: string | null | undefined,
): ImportedPriority {
  return PRIORITIES[value?.toLowerCase() ?? ""] ?? "no-priority";
}

export function toHexColor(value: string | null | undefined): string {
  const hex = value?.trim().replace(/^#/, "").toLowerCase() ?? "";
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${[...hex].map((char) => char + char).join("")}`;
  }
  return FALLBACK_LABEL_COLOR;
}

export function toPlaneUser(member: PlaneMember): PlaneUser {
  return member.member && typeof member.member === "object"
    ? member.member
    : member;
}

export function toPerson(user: PlaneUser): ImportedPerson {
  const fullName = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  const name = fullName || user.display_name?.trim() || undefined;
  const email = user.email?.trim() || undefined;
  return { ...(name ? { name } : {}), ...(email ? { email } : {}) };
}

export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function sortWorkItems(
  items: PlaneWorkItem[],
  columns: ImportedColumn[],
): PlaneWorkItem[] {
  const rank = new Map(columns.map((column, index) => [column.key, index]));
  const columnRank = (item: PlaneWorkItem) =>
    (item.state ? rank.get(item.state) : undefined) ?? columns.length;
  return [...items].sort(
    (a, b) =>
      columnRank(a) - columnRank(b) ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      (a.sequence_id ?? 0) - (b.sequence_id ?? 0),
  );
}

export function mapPlaneProject(data: PlaneProjectData): ImportedProject {
  const usersById = new Map<string, PlaneUser>();
  for (const member of data.members ?? []) {
    const user = toPlaneUser(member);
    if (user?.id) usersById.set(user.id, user);
  }
  const toMarkdown = createHtmlToMarkdown({
    mentionName: (id) => {
      const user = usersById.get(id);
      return user
        ? user.display_name?.trim() || toPerson(user).name
        : undefined;
    },
  });

  const columns = mapColumns(data.states);
  const columnKeys = new Set(columns.map((column) => column.key));
  const labelsById = new Map(data.labels.map((label) => [label.id, label]));
  const items = sortWorkItems(data.workItems, columns);
  const itemIds = new Set(items.map((item) => item.id));
  const usedLabelIds = new Set<string>();
  let multipleAssignees = 0;

  const tasks: ImportedTask[] = items.map((item) => {
    const assignees = item.assignees ?? [];
    if (assignees.length > 1) multipleAssignees++;
    const assignee = resolveAssignee(assignees[0], usersById);

    const labelKeys = [
      ...new Set((item.labels ?? []).filter((id) => labelsById.has(id))),
    ];
    for (const id of labelKeys) usedLabelIds.add(id);

    const startDate = toIsoDate(item.start_date);
    const dueDate = toIsoDate(item.target_date);
    const createdAt = toIsoDate(item.created_at);

    return {
      key: item.id,
      ...(typeof item.sequence_id === "number"
        ? { number: item.sequence_id }
        : {}),
      columnKey: item.state && columnKeys.has(item.state) ? item.state : null,
      ...(item.archived_at ? { archived: true } : {}),
      title: item.name?.trim() || "Untitled",
      description: toMarkdown(item.description_html),
      priority: mapPriority(item.priority),
      ...(startDate ? { startDate } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(assignee ? { assignee } : {}),
      labelKeys,
      comments: mapComments(
        data.comments.get(item.id) ?? [],
        usersById,
        toMarkdown,
      ),
    };
  });

  const labels: ImportedLabel[] = data.labels
    .filter((label) => usedLabelIds.has(label.id))
    .map((label) => ({
      key: label.id,
      name: label.name?.trim() || "Label",
      color: toHexColor(label.color),
    }));

  const relations: ImportedRelation[] = items
    .filter(
      (item) =>
        item.parent && item.parent !== item.id && itemIds.has(item.parent),
    )
    .map((item) => ({
      sourceKey: item.parent as string,
      targetKey: item.id,
      type: "subtask",
    }));

  const warnings: string[] = [];
  if (multipleAssignees > 0) {
    warnings.push(
      `${multipleAssignees} work ${multipleAssignees === 1 ? "item has" : "items have"} more than one assignee. Kaneo keeps one assignee per task, so only the first was assigned.`,
    );
  }
  if (data.members === null) warnings.push(MEMBERS_WARNING);

  const description = data.project.description?.trim();
  const key = data.project.identifier?.trim();
  return {
    name: data.project.name?.trim() || "Plane project",
    ...(key ? { key } : {}),
    ...(description ? { description } : {}),
    columns,
    labels,
    tasks,
    relations,
    warnings,
  };
}

function resolveAssignee(
  assignee: string | PlaneUser | undefined,
  usersById: Map<string, PlaneUser>,
): ImportedPerson | undefined {
  if (!assignee) return undefined;
  const user =
    typeof assignee === "string"
      ? usersById.get(assignee)
      : (usersById.get(assignee.id) ?? assignee);
  if (!user) return undefined;
  const person = toPerson(user);
  return person.name || person.email ? person : undefined;
}

function mapComments(
  comments: PlaneComment[],
  usersById: Map<string, PlaneUser>,
  toMarkdown: HtmlToMarkdown,
): ImportedComment[] {
  const mapped: ImportedComment[] = [];
  for (const comment of comments) {
    const body =
      comment.comment_html != null
        ? toMarkdown(comment.comment_html)
        : (comment.comment_stripped?.trim() ?? "");
    if (!body) continue;

    const actor = commentActor(comment, usersById);
    const person = actor ? toPerson(actor) : {};
    const createdAt = toIsoDate(comment.created_at);
    mapped.push({
      author: {
        name: person.name ?? person.email ?? "Plane user",
        ...(person.email ? { email: person.email } : {}),
      },
      body,
      ...(createdAt ? { createdAt } : {}),
    });
  }
  return mapped.sort((a, b) =>
    (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );
}

function commentActor(
  comment: PlaneComment,
  usersById: Map<string, PlaneUser>,
): PlaneUser | undefined {
  const actor =
    typeof comment.actor === "object" && comment.actor
      ? comment.actor
      : (comment.actor_detail ?? undefined);
  const id = typeof comment.actor === "string" ? comment.actor : actor?.id;
  return (id ? usersById.get(id) : undefined) ?? actor;
}

function groupRank(group: string | null | undefined): number {
  const index = STATE_GROUP_ORDER.indexOf(group?.toLowerCase() ?? "");
  return index === -1 ? STATE_GROUP_ORDER.length : index;
}
