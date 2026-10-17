export type ColumnRef = {
  readonly id?: string;
  readonly slug: string;
  readonly name: string;
};

const ALIASES: Readonly<Record<string, ReadonlyArray<string>>> = {
  doing: ["inprogress"],
  started: ["inprogress"],
  wip: ["inprogress"],
  progress: ["inprogress"],
  review: ["inreview"],
  reviewing: ["inreview"],
  complete: ["done"],
  completed: ["done"],
  finished: ["done"],
  closed: ["done"],
};

function lower(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function compact(value: string): string {
  return lower(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function only<C>(matches: ReadonlyArray<C>): C | undefined {
  return matches.length === 1 ? matches[0] : undefined;
}

export function matchColumn<C extends ColumnRef>(
  columns: ReadonlyArray<C>,
  reference: string,
): C | undefined {
  const trimmed = reference.trim();
  const wanted = lower(reference);
  const key = compact(reference);
  if (key === "") return undefined;
  const compactOf = (column: C) => [compact(column.slug), compact(column.name)];
  const exact =
    columns.find((column) => column.id === trimmed) ??
    columns.find((column) => lower(column.slug) === wanted) ??
    only(columns.filter((column) => lower(column.name) === wanted));
  if (exact) return exact;
  const loose = only(
    columns.filter((column) => compactOf(column).includes(key)),
  );
  if (loose) return loose;
  const targets = ALIASES[key];
  if (!targets) return undefined;
  return only(
    columns.filter((column) =>
      compactOf(column).some((form) => targets.includes(form)),
    ),
  );
}
