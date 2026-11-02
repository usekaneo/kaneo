import { replaceEqualDeep } from "@tanstack/react-query";

type Card = { id: string };
type Column = { id: string; tasks: Card[] };
type Board = {
  columns: Column[];
  plannedTasks?: Card[];
  archivedTasks?: Card[];
};

function isBoard(value: unknown): value is Board {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Board).columns)
  );
}

function shareList<T>(previous: T[] | undefined, next: T[]) {
  return previous?.length === next.length &&
    next.every((item, index) => item === previous[index])
    ? previous
    : next;
}

export function shareBoardTasks(previous: unknown, next: unknown): unknown {
  if (!isBoard(previous) || !isBoard(next))
    return replaceEqualDeep(previous, next);

  const known = new Map<string, Card>();
  for (const card of [
    ...previous.columns.flatMap((column) => column.tasks),
    ...(previous.plannedTasks ?? []),
    ...(previous.archivedTasks ?? []),
  ])
    known.set(card.id, card);
  const keep = (card: Card) => {
    const old = known.get(card.id);
    return old ? replaceEqualDeep(old, card) : card;
  };
  const keepAll = (previousCards: Card[] | undefined, cards?: Card[]) =>
    cards && shareList(previousCards, cards.map(keep));

  const previousColumns = new Map(
    previous.columns.map((column) => [column.id, column]),
  );
  const columns = shareList(
    previous.columns,
    next.columns.map((column) => {
      const old = previousColumns.get(column.id);
      const { tasks: oldTasks, ...oldRest } = old ?? { tasks: undefined };
      const { tasks: nextTasks, ...nextRest } = column;
      const tasks = keepAll(oldTasks, nextTasks) ?? [];
      const rest = old ? replaceEqualDeep(oldRest, nextRest) : nextRest;
      return old && rest === oldRest && tasks === oldTasks
        ? old
        : { ...rest, tasks };
    }),
  );
  const plannedTasks = keepAll(previous.plannedTasks, next.plannedTasks);
  const archivedTasks = keepAll(previous.archivedTasks, next.archivedTasks);

  const {
    columns: _previousColumns,
    plannedTasks: _previousPlanned,
    archivedTasks: _previousArchived,
    ...previousRest
  } = previous;
  const {
    columns: _nextColumns,
    plannedTasks: _nextPlanned,
    archivedTasks: _nextArchived,
    ...nextRest
  } = next;
  const rest = replaceEqualDeep(previousRest, nextRest);

  return rest === previousRest &&
    columns === previous.columns &&
    plannedTasks === previous.plannedTasks &&
    archivedTasks === previous.archivedTasks
    ? previous
    : { ...rest, columns, plannedTasks, archivedTasks };
}
