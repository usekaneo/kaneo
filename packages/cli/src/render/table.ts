import { type Cell, cellWidth, fitCell, renderCell } from "./cell.js";
import type { Ui } from "./ui.js";
import { padEnd, padStart, stringWidth } from "./width.js";

export type Column<Row> = {
  readonly header: string;
  readonly cell: (row: Row) => Cell;
  readonly align?: "left" | "right";
  readonly flex?: boolean;
  readonly minWidth?: number;
  readonly optional?: boolean;
};

export type TableOptions = {
  readonly width: number;
  readonly gap?: number;
  readonly indent?: number;
  readonly header?: boolean;
};

export type TableLayout = {
  readonly visible: ReadonlyArray<number>;
  readonly widths: ReadonlyArray<number>;
};

export function layoutColumns(
  natural: ReadonlyArray<number>,
  columns: ReadonlyArray<Pick<Column<never>, "flex" | "minWidth" | "optional">>,
  available: number,
  gap: number,
): TableLayout {
  const widths = [...natural];
  const visible = columns.map((_, index) => index);
  const total = () =>
    visible.reduce((sum, index) => sum + (widths[index] ?? 0), 0) +
    gap * Math.max(0, visible.length - 1);
  const minWidth = (index: number) =>
    Math.min(natural[index] ?? 0, columns[index]?.minWidth ?? 8);

  const shrink = (indexes: ReadonlyArray<number>) => {
    for (const index of indexes) {
      const excess = total() - available;
      if (excess <= 0) return;
      const current = widths[index] ?? 0;
      widths[index] = Math.max(minWidth(index), current - excess);
    }
  };

  const flexible = () => visible.filter((index) => columns[index]?.flex);
  shrink(flexible());
  while (total() > available) {
    const optional = [...visible]
      .reverse()
      .find((index) => columns[index]?.optional);
    if (optional === undefined) break;
    visible.splice(visible.indexOf(optional), 1);
    shrink(flexible());
  }
  if (total() > available) {
    shrink([...visible].sort((a, b) => (widths[b] ?? 0) - (widths[a] ?? 0)));
  }
  return { visible, widths };
}

export function renderTable<Row>(
  ui: Ui,
  rows: ReadonlyArray<Row>,
  columns: ReadonlyArray<Column<Row>>,
  options: TableOptions,
): string[] {
  const gap = options.gap ?? 2;
  const indent = options.indent ?? 0;
  const showHeader = options.header ?? false;
  const cells = rows.map((row) => columns.map((column) => column.cell(row)));
  const natural = columns.map((column, index) =>
    Math.max(
      showHeader ? stringWidth(column.header) : 0,
      ...cells.map((row) => cellWidth(row[index] ?? [])),
    ),
  );
  const { visible, widths } = layoutColumns(
    natural,
    columns,
    options.width - indent,
    gap,
  );
  const separator = " ".repeat(gap);
  const prefix = " ".repeat(indent);

  const line = (rendered: ReadonlyArray<string>) =>
    (prefix + rendered.join(separator)).trimEnd();

  const renderRow = (row: ReadonlyArray<Cell>) =>
    line(
      visible.map((index) => {
        const width = widths[index] ?? 0;
        const fitted = fitCell(row[index] ?? [], width, ui.glyphs.ellipsis);
        const rendered = renderCell(fitted, ui);
        return columns[index]?.align === "right"
          ? padStart(rendered, width)
          : padEnd(rendered, width);
      }),
    );

  const header = showHeader
    ? [
        line(
          visible.map((index) => {
            const width = widths[index] ?? 0;
            const title = ui.theme.muted(columns[index]?.header ?? "");
            return columns[index]?.align === "right"
              ? padStart(title, width)
              : padEnd(title, width);
          }),
        ),
      ]
    : [];

  return [...header, ...cells.map(renderRow)];
}
