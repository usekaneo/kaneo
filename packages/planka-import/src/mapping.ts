import { RESERVED_COLUMN_SLUGS, toColumnSlug } from "./keys.js";
import type {
  PlankaCard,
  PlankaComment,
  PlankaList,
  PlankaTask,
  PlankaTaskList,
  PlankaUser,
} from "./planka.js";

export type PlannedColumn = {
  listId: string;
  name: string;
  slug: string;
  isFinal: boolean;
  renamedFrom?: string;
};

const UNTITLED_COLUMN = "Untitled";

// Kaneo rejects duplicate and reserved slugs, so a colliding name has to be
// adjusted before the column is created.
export function planColumns(lists: PlankaList[]): PlannedColumn[] {
  const ordered = [...lists].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  const takenSlugs = new Set<string>();
  const planned: PlannedColumn[] = [];

  for (const list of ordered) {
    const original = list.name?.trim() || UNTITLED_COLUMN;
    let name = toColumnSlug(original) ? original : UNTITLED_COLUMN;

    if (RESERVED_COLUMN_SLUGS.includes(toColumnSlug(name))) {
      name = `${name} list`;
    }

    let slug = toColumnSlug(name);
    for (let suffix = 2; takenSlugs.has(slug); suffix++) {
      name = `${name.replace(/ \d+$/, "")} ${suffix}`;
      slug = toColumnSlug(name);
    }

    takenSlugs.add(slug);
    planned.push({
      listId: list.id,
      name,
      slug,
      isFinal: list.type === "closed",
      ...(name !== original ? { renamedFrom: original } : {}),
    });
  }

  return planned;
}

export function sortCards(cards: PlankaCard[]): PlankaCard[] {
  return [...cards].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export function buildDescription(
  card: PlankaCard,
  taskLists: PlankaTaskList[],
  tasks: PlankaTask[],
): string {
  const sections: string[] = [];
  const description = card.description?.trim();
  if (description) sections.push(description);

  for (const taskList of taskLists) {
    // Items pointing at another card become task relations instead, so they
    // are not also flattened into checkbox text.
    const items = tasks
      .filter((task) => task.taskListId === taskList.id && !task.linkedCardId)
      .sort((a, b) => a.position - b.position);

    if (items.length === 0) continue;

    const lines = items.map(
      (item) => `- [${item.isCompleted ? "x" : " "}] ${item.name}`,
    );
    sections.push(`## ${taskList.name}\n\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

export function displayName(user: PlankaUser | undefined): string {
  if (!user) return "Unknown user";
  return (
    user.name?.trim() || user.username?.trim() || user.email || "Unknown user"
  );
}

export function formatComment(
  comment: PlankaComment,
  _author: PlankaUser | undefined,
): string {
  const date = comment.createdAt
    ? new Date(comment.createdAt).toISOString().slice(0, 10)
    : null;

  return date
    ? `${comment.text}\n\n_Originally posted on ${date}._`
    : comment.text;
}

/** PLANKA has no priority field; Kaneo requires one on create. */
export const DEFAULT_PRIORITY = "no-priority";

export function toDueDate(card: PlankaCard): string | undefined {
  if (!card.dueDate) return undefined;
  const parsed = new Date(card.dueDate);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function boardProjectName(
  projectName: string,
  boardName: string,
  boardCountInProject: number,
): string {
  if (boardCountInProject <= 1) return projectName;
  return `${projectName} - ${boardName}`;
}
