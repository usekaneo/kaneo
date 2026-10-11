import { RESERVED_COLUMN_SLUGS, toColumnSlug } from "../keys.js";
import { checklistSection, joinSections } from "../markdown.js";
import type {
  PlankaBoard,
  PlankaCard,
  PlankaComment,
  PlankaList,
  PlankaProject,
  PlankaTask,
  PlankaTaskList,
  PlankaUser,
  ProjectsBundle,
} from "./client.js";

export type PlannedColumn = {
  listId: string;
  name: string;
  slug: string;
  isFinal: boolean;
  renamedFrom?: string;
};

export const UNTITLED_COLUMN = "Untitled";

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
  const sections: string[] = [card.description ?? ""];

  for (const taskList of taskLists) {
    const items = tasks
      .filter((task) => task.taskListId === taskList.id && !task.linkedCardId)
      .sort((a, b) => a.position - b.position);

    if (items.length === 0) continue;

    sections.push(
      checklistSection(
        taskList.name,
        items.map((item) => ({
          name: item.name,
          done: Boolean(item.isCompleted),
        })),
      ),
    );
  }

  return joinSections(sections);
}

export function displayName(user: PlankaUser | undefined): string {
  if (!user) return "Unknown user";
  return (
    user.name?.trim() || user.username?.trim() || user.email || "Unknown user"
  );
}

export function formatComment(comment: PlankaComment): string {
  const date = comment.createdAt
    ? new Date(comment.createdAt).toISOString().slice(0, 10)
    : null;

  return date
    ? `${comment.text}\n\n_Originally posted on ${date}._`
    : comment.text;
}

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

export type PlankaBoardEntry = {
  project: PlankaProject;
  board: PlankaBoard;
  boardCountInProject: number;
};

export function listBoardEntries(bundle: ProjectsBundle): PlankaBoardEntry[] {
  const boards = bundle.included.boards ?? [];
  const entries: PlankaBoardEntry[] = [];

  for (const project of bundle.items) {
    const projectBoards = boards
      .filter((board) => board.projectId === project.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    for (const board of projectBoards) {
      entries.push({
        project,
        board,
        boardCountInProject: projectBoards.length,
      });
    }
  }

  return entries;
}
