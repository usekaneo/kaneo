import { toIsoDate } from "../markdown.js";
import type {
  ImportedColumn,
  ImportedComment,
  ImportedLabel,
  ImportedPerson,
  ImportedProject,
  ImportedRelation,
  ImportedTask,
} from "../types.js";
import {
  type BoardBundle,
  MIGRATABLE_LIST_TYPES,
  type PlankaCard,
  type PlankaComment,
  type PlankaUser,
} from "./client.js";
import { labelColorToHex } from "./colors.js";
import {
  buildDescription,
  DEFAULT_PRIORITY,
  displayName,
  sortCards,
  toDueDate,
  UNTITLED_COLUMN,
} from "./mapping.js";

export type CardComments = {
  comments: PlankaComment[];
  users: PlankaUser[];
};

export function importableCards(bundle: BoardBundle): PlankaCard[] {
  const listIds = new Set(
    (bundle.included.lists ?? [])
      .filter((list) => MIGRATABLE_LIST_TYPES.includes(list.type))
      .map((list) => list.id),
  );
  return sortCards(
    (bundle.included.cards ?? []).filter((card) => listIds.has(card.listId)),
  );
}

export function mapBoard(
  bundle: BoardBundle,
  name: string,
  commentsByCardId: Map<string, CardComments>,
): ImportedProject {
  const included = bundle.included;
  const columns = mapColumns(bundle);
  const cards = importableCards(bundle);
  const cardIds = new Set(cards.map((card) => card.id));
  const taskLists = included.taskLists ?? [];
  const checklistItems = included.tasks ?? [];
  const labelIdsByCard = groupBy(
    included.cardLabels ?? [],
    (link) => link.cardId,
    (link) => link.labelId,
  );
  const memberIdsByCard = groupBy(
    included.cardMemberships ?? [],
    (membership) => membership.cardId,
    (membership) => membership.userId,
  );
  const taskListsByCard = groupBy(
    taskLists,
    (taskList) => taskList.cardId,
    (taskList) => taskList,
  );
  const boardLabelIds = new Set((included.labels ?? []).map((l) => l.id));
  const usersById = new Map<string, PlankaUser>(
    (included.users ?? []).map((user) => [user.id, user]),
  );
  for (const { users } of commentsByCardId.values()) {
    for (const user of users) {
      if (!usersById.has(user.id)) usersById.set(user.id, user);
    }
  }

  let extraMembers = 0;
  let hiddenEmails = 0;
  const usedLabelIds = new Set<string>();

  const tasks: ImportedTask[] = cards.map((card) => {
    const memberIds = memberIdsByCard.get(card.id) ?? [];
    if (memberIds.length > 1) extraMembers++;

    let assignee: ImportedPerson | undefined;
    const firstMemberId = memberIds[0];
    if (firstMemberId) {
      assignee = toPerson(usersById.get(firstMemberId));
      if (!assignee.email) hiddenEmails++;
    }

    const labelKeys = [
      ...new Set(
        (labelIdsByCard.get(card.id) ?? []).filter((labelId) =>
          boardLabelIds.has(labelId),
        ),
      ),
    ];
    for (const labelId of labelKeys) usedLabelIds.add(labelId);

    const dueDate = toDueDate(card);
    const createdAt = toIsoDate(card.createdAt);

    return {
      key: card.id,
      columnKey: card.listId,
      title: card.name,
      description: buildDescription(
        card,
        taskListsByCard.get(card.id) ?? [],
        checklistItems,
      ),
      priority: DEFAULT_PRIORITY,
      ...(dueDate ? { dueDate } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(assignee ? { assignee } : {}),
      labelKeys,
      comments: mapComments(commentsByCardId.get(card.id), usersById),
    };
  });

  const labels: ImportedLabel[] = (included.labels ?? [])
    .filter((label) => usedLabelIds.has(label.id))
    .sort((a, b) => a.position - b.position)
    .map((label) => ({
      key: label.id,
      name: label.name?.trim() || label.color,
      color: labelColorToHex(label.color),
    }));

  const relations: ImportedRelation[] = [];
  const seenRelations = new Set<string>();
  let externalLinks = 0;
  const cardIdByTaskListId = new Map(
    taskLists.map((taskList) => [taskList.id, taskList.cardId]),
  );
  for (const item of checklistItems) {
    if (!item.linkedCardId) continue;
    const parentId = cardIdByTaskListId.get(item.taskListId);
    if (!parentId || !cardIds.has(parentId)) continue;
    if (!cardIds.has(item.linkedCardId)) {
      externalLinks++;
      continue;
    }
    if (parentId === item.linkedCardId) continue;

    const id = `${parentId}:${item.linkedCardId}`;
    if (seenRelations.has(id)) continue;
    seenRelations.add(id);
    relations.push({
      sourceKey: parentId,
      targetKey: item.linkedCardId,
      type: "subtask",
    });
  }

  const attachments = (included.attachments ?? []).filter((attachment) =>
    cardIds.has(attachment.cardId),
  ).length;

  const warnings: string[] = [];
  if (attachments > 0) {
    warnings.push(
      `${count(attachments, "attachment")} ${attachments === 1 ? "was" : "were"} not imported.`,
    );
  }
  if (extraMembers > 0) {
    warnings.push(
      `${count(extraMembers, "card")} had more than one member. Kaneo keeps one assignee per task, so only the first member was assigned.`,
    );
  }
  if (hiddenEmails > 0) {
    warnings.push(
      `PLANKA hid the assignee email on ${count(hiddenEmails, "card")}. Connect with a PLANKA admin account so assignees can be matched by email.`,
    );
  }
  if (externalLinks > 0) {
    warnings.push(
      `${count(externalLinks, "checklist item")} linked to cards on other boards and ${externalLinks === 1 ? "was" : "were"} not imported.`,
    );
  }

  return { name, columns, labels, tasks, relations, warnings };
}

function mapColumns(bundle: BoardBundle): ImportedColumn[] {
  return (bundle.included.lists ?? [])
    .filter((list) => MIGRATABLE_LIST_TYPES.includes(list.type))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((list) => ({
      key: list.id,
      name: list.name?.trim() || UNTITLED_COLUMN,
      isFinal: list.type === "closed",
    }));
}

function mapComments(
  entry: CardComments | undefined,
  usersById: Map<string, PlankaUser>,
): ImportedComment[] {
  if (!entry) return [];
  return entry.comments.map((comment) => {
    const createdAt = toIsoDate(comment.createdAt);
    return {
      author: toPerson(
        comment.userId ? usersById.get(comment.userId) : undefined,
      ),
      body: comment.text,
      ...(createdAt ? { createdAt } : {}),
    };
  });
}

function toPerson(user: PlankaUser | undefined): ImportedPerson {
  return {
    name: displayName(user),
    ...(user?.email ? { email: user.email } : {}),
  };
}

function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function groupBy<T, V>(
  items: T[],
  keyOf: (item: T) => string,
  valueOf: (item: T) => V,
): Map<string, V[]> {
  const groups = new Map<string, V[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(valueOf(item));
    else groups.set(key, [valueOf(item)]);
  }
  return groups;
}
