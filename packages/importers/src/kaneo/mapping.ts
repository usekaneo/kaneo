import { toIsoDate } from "../markdown.js";
import type {
  ImportedColumn,
  ImportedComment,
  ImportedLabel,
  ImportedPerson,
  ImportedPriority,
  ImportedRelation,
  ImportedRelationType,
  ImportedTask,
} from "../types.js";
import { ARCHIVED_STATUS, columnSlug } from "./board.js";
import type {
  KaneoActivity,
  KaneoBoardColumn,
  KaneoBoardTask,
  KaneoMember,
  KaneoRelation,
} from "./client.js";
import { kaneoColorToHex } from "./colors.js";

const PRIORITIES: ImportedPriority[] = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
];

const RELATION_TYPES: ImportedRelationType[] = ["subtask", "blocks", "related"];

export const UNKNOWN_AUTHOR = "Unknown user";

export function mapPriority(
  value: string | null | undefined,
): ImportedPriority {
  const normalized = value?.trim().toLowerCase();
  return (
    PRIORITIES.find((priority) => priority === normalized) ?? "no-priority"
  );
}

export function mapColumns(columns: KaneoBoardColumn[]): ImportedColumn[] {
  return columns.map((column) => {
    const key = columnSlug(column);
    return {
      key,
      name: column.name,
      isFinal: column.isFinal ?? key === "done",
    };
  });
}

export function collectLabels(tasks: KaneoBoardTask[]): ImportedLabel[] {
  const labels = new Map<string, ImportedLabel>();
  for (const task of tasks) {
    for (const label of task.labels ?? []) {
      const name = label.name.trim();
      if (!name || labels.has(name)) continue;
      labels.set(name, {
        key: name,
        name,
        color: kaneoColorToHex(label.color),
      });
    }
  }
  return [...labels.values()];
}

export function mapAssignee(
  task: KaneoBoardTask,
  members: Map<string, KaneoMember>,
): ImportedPerson | undefined {
  if (!task.userId) return undefined;
  const member = members.get(task.userId);
  const name = member?.name?.trim() || task.assigneeName?.trim() || undefined;
  const email = member?.email?.trim() || undefined;
  if (!name && !email) return undefined;
  return { ...(name ? { name } : {}), ...(email ? { email } : {}) };
}

export type TaskExtras = {
  description?: string | null;
  comments?: ImportedComment[];
};

export function mapTask(
  task: KaneoBoardTask,
  columnKeys: Set<string>,
  members: Map<string, KaneoMember>,
  extras: TaskExtras = {},
): ImportedTask {
  const archived = task.status === ARCHIVED_STATUS;
  const assignee = mapAssignee(task, members);
  const labelKeys = [
    ...new Set(
      (task.labels ?? []).map((label) => label.name.trim()).filter(Boolean),
    ),
  ];

  return {
    key: task.id,
    ...(typeof task.number === "number" ? { number: task.number } : {}),
    columnKey: !archived && columnKeys.has(task.status) ? task.status : null,
    ...(archived ? { archived: true } : {}),
    title: task.title,
    description: extras.description ?? task.description ?? "",
    priority: mapPriority(task.priority),
    startDate: toIsoDate(task.startDate),
    dueDate: toIsoDate(task.dueDate),
    createdAt: toIsoDate(task.createdAt),
    ...(assignee ? { assignee } : {}),
    labelKeys,
    comments: extras.comments ?? [],
  };
}

export function commentActivities(
  activities: KaneoActivity[],
): KaneoActivity[] {
  return activities
    .filter(
      (activity) => activity.type === "comment" && activity.content?.trim(),
    )
    .map((activity, index) => ({ activity, index }))
    .sort((a, b) => {
      const diff = timeOf(a.activity.createdAt) - timeOf(b.activity.createdAt);
      return diff !== 0 ? diff : b.index - a.index;
    })
    .map(({ activity }) => activity);
}

export function needsAuthorNames(
  activities: KaneoActivity[],
  members: Map<string, KaneoMember>,
): boolean {
  return commentActivities(activities).some(
    (activity) =>
      !activity.externalUserName?.trim() &&
      !(activity.userId && members.has(activity.userId)),
  );
}

export function commentAuthor(
  activity: KaneoActivity,
  members: Map<string, KaneoMember>,
  names: Map<string, string>,
): ImportedPerson {
  const external = activity.externalUserName?.trim();
  if (external) return { name: external };

  const member = activity.userId ? members.get(activity.userId) : undefined;
  if (member) {
    const email = member.email?.trim();
    return {
      name: member.name?.trim() || email || UNKNOWN_AUTHOR,
      ...(email ? { email } : {}),
    };
  }

  return { name: names.get(activity.id)?.trim() || UNKNOWN_AUTHOR };
}

export function mapComments(
  activities: KaneoActivity[],
  members: Map<string, KaneoMember>,
  names: Map<string, string> = new Map(),
): ImportedComment[] {
  return commentActivities(activities).map((activity) => ({
    author: commentAuthor(activity, members, names),
    body: activity.content ?? "",
    createdAt: toIsoDate(activity.createdAt),
  }));
}

export type MappedRelations = {
  relations: ImportedRelation[];
  outsideProject: number;
};

export function mapRelations(
  relations: KaneoRelation[],
  taskIds: Set<string>,
): MappedRelations {
  const seen = new Set<string>();
  const mapped: ImportedRelation[] = [];
  let outsideProject = 0;

  for (const relation of relations) {
    const type = RELATION_TYPES.find(
      (value) => value === relation.relationType,
    );
    if (!type || relation.sourceTaskId === relation.targetTaskId) continue;

    const identity = `${relation.sourceTaskId}:${relation.targetTaskId}:${type}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    if (
      !taskIds.has(relation.sourceTaskId) ||
      !taskIds.has(relation.targetTaskId)
    ) {
      outsideProject++;
      continue;
    }

    mapped.push({
      sourceKey: relation.sourceTaskId,
      targetKey: relation.targetTaskId,
      type,
    });
  }

  return { relations: mapped, outsideProject };
}

function timeOf(value: string): number {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}
