import { checklistSection, joinSections, toIsoDate } from "../markdown.js";
import type {
  ImportedColumn,
  ImportedComment,
  ImportedLabel,
  ImportedPerson,
  ImportedProject,
  ImportedTask,
} from "../types.js";
import type {
  TrelloBoard,
  TrelloCard,
  TrelloChecklist,
  TrelloLabel,
  TrelloList,
  TrelloMember,
} from "./client.js";
import { trelloColorName, trelloLabelColor } from "./colors.js";
import { trelloPerson } from "./people.js";

const FINAL_LIST_NAME =
  /^(done|complete|completed|closed|finished|shipped|archive)/i;

const TRELLO_ID = /^[0-9a-f]{24}$/i;

export type BoardContext = {
  owner: TrelloMember;
  comments?: Map<string, ImportedComment[]>;
};

type CardContext = BoardContext & {
  openListIds: Set<string>;
  fallbackColumnKey: string | null;
  labels: Map<string, TrelloLabel>;
  members: Map<string, TrelloMember>;
  checklists: Map<string, TrelloChecklist[]>;
};

export function mapBoard(
  board: TrelloBoard,
  context: BoardContext,
): ImportedProject {
  const lists = byPosition(board.lists ?? []);
  const openLists = lists.filter((list) => !list.closed);
  const listOrder = new Map(lists.map((list, index) => [list.id, index]));
  const cards = sortCards(board.cards ?? [], listOrder);

  const cardContext: CardContext = {
    ...context,
    openListIds: new Set(openLists.map((list) => list.id)),
    fallbackColumnKey: openLists[0]?.id ?? null,
    labels: new Map((board.labels ?? []).map((label) => [label.id, label])),
    members: new Map(
      (board.members ?? []).map((member) => [member.id, member]),
    ),
    checklists: groupChecklists(board.checklists ?? []),
  };

  const tasks = cards.map((card) => mapCard(card, cardContext));
  const description = board.desc?.trim();

  return {
    name: board.name,
    ...(description ? { description } : {}),
    columns: mapColumns(openLists),
    labels: mapUsedLabels(board.labels ?? [], tasks),
    tasks,
    relations: [],
    warnings: boardWarnings(cards, tasks),
  };
}

export function mapColumns(openLists: TrelloList[]): ImportedColumn[] {
  const last = openLists[openLists.length - 1];
  return openLists.map((list) => {
    const name = list.name.trim() || "Untitled list";
    return {
      key: list.id,
      name,
      isFinal: list === last && FINAL_LIST_NAME.test(name),
    };
  });
}

export function mapLabel(label: TrelloLabel): ImportedLabel {
  return {
    key: label.id,
    name: label.name?.trim() || trelloColorName(label.color) || "Label",
    color: trelloLabelColor(label.color),
  };
}

export function cardCreatedAt(cardId: string): string | undefined {
  if (!TRELLO_ID.test(cardId)) return undefined;
  const seconds = Number.parseInt(cardId.slice(0, 8), 16);
  return seconds > 0 ? new Date(seconds * 1000).toISOString() : undefined;
}

function mapCard(card: TrelloCard, context: CardContext): ImportedTask {
  const listIsOpen = context.openListIds.has(card.idList);
  const archived = Boolean(card.closed) || !listIsOpen;
  const startDate = toIsoDate(card.start);
  const dueDate = toIsoDate(card.due);
  const createdAt = cardCreatedAt(card.id);
  const assignee = mapAssignee(card.idMembers ?? [], context);

  return {
    key: card.id,
    ...(typeof card.idShort === "number" ? { number: card.idShort } : {}),
    columnKey: listIsOpen ? card.idList : context.fallbackColumnKey,
    ...(archived ? { archived: true } : {}),
    title: card.name.trim() || "Untitled card",
    description: cardDescription(card, context.checklists.get(card.id) ?? []),
    priority: "no-priority",
    ...(startDate ? { startDate } : {}),
    ...(dueDate ? { dueDate } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(assignee ? { assignee } : {}),
    labelKeys: [...new Set(card.idLabels ?? [])].filter((id) =>
      context.labels.has(id),
    ),
    comments: context.comments?.get(card.id) ?? [],
  };
}

function cardDescription(
  card: TrelloCard,
  checklists: TrelloChecklist[],
): string {
  return joinSections([
    card.desc,
    ...checklists
      .filter((checklist) => (checklist.checkItems ?? []).length > 0)
      .map((checklist) =>
        checklistSection(
          checklist.name,
          byPosition(checklist.checkItems ?? []).map((item) => ({
            name: item.name,
            done: item.state === "complete",
          })),
        ),
      ),
  ]);
}

function mapAssignee(
  memberIds: string[],
  context: CardContext,
): ImportedPerson | undefined {
  for (const id of memberIds) {
    const member =
      context.members.get(id) ??
      (id === context.owner.id ? context.owner : undefined);
    const person = trelloPerson(member, context.owner);
    if (person) return person;
  }
  return undefined;
}

function mapUsedLabels(
  labels: TrelloLabel[],
  tasks: ImportedTask[],
): ImportedLabel[] {
  const used = new Set(tasks.flatMap((task) => task.labelKeys));
  return labels.filter((label) => used.has(label.id)).map(mapLabel);
}

function boardWarnings(cards: TrelloCard[], tasks: ImportedTask[]): string[] {
  const warnings: string[] = [];

  const sharedCards = cards.filter(
    (card) => (card.idMembers?.length ?? 0) > 1,
  ).length;
  if (sharedCards > 0) {
    warnings.push(
      `${cardCount(sharedCards)} had more than one member. Kaneo keeps one assignee per task, so only the first member was kept.`,
    );
  }

  if (tasks.some((task) => task.assignee && !task.assignee.email)) {
    warnings.push(
      "Trello does not share members' email addresses, so assignees are matched to Kaneo members by full name.",
    );
  }

  const cardsWithAttachments = cards.filter(
    (card) => (card.badges?.attachments ?? 0) > 0,
  ).length;
  if (cardsWithAttachments > 0) {
    warnings.push(
      `Attachments on ${cardCount(cardsWithAttachments)}, custom fields, Power-Up data, and stickers are not imported.`,
    );
  }

  return warnings;
}

function groupChecklists(
  checklists: TrelloChecklist[],
): Map<string, TrelloChecklist[]> {
  const byCard = new Map<string, TrelloChecklist[]>();
  for (const checklist of byPosition(checklists)) {
    const group = byCard.get(checklist.idCard);
    if (group) group.push(checklist);
    else byCard.set(checklist.idCard, [checklist]);
  }
  return byCard;
}

function sortCards(
  cards: TrelloCard[],
  listOrder: Map<string, number>,
): TrelloCard[] {
  const listIndex = (card: TrelloCard) =>
    listOrder.get(card.idList) ?? Number.MAX_SAFE_INTEGER;
  return [...cards].sort(
    (a, b) => listIndex(a) - listIndex(b) || position(a) - position(b),
  );
}

function byPosition<T extends { pos: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => position(a) - position(b));
}

function position(item: { pos: number }): number {
  return Number.isFinite(item.pos) ? item.pos : 0;
}

function cardCount(count: number): string {
  return `${count} ${count === 1 ? "card" : "cards"}`;
}
