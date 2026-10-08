import { describe, expect, it } from "vite-plus/test";
import { text } from "./cell.js";
import { layoutColumns, renderTable } from "./table.js";
import { makeUi } from "./ui.js";
import { stringWidth } from "./width.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

type Row = { id: string; title: string; owner: string };

const rows: Row[] = [
  {
    id: "KAN-1",
    title: "Fix login redirect after device approval",
    owner: "Ada Lovelace",
  },
  { id: "KAN-22", title: "Dark mode", owner: "Grace Hopper" },
];

const columns = [
  { header: "ID", cell: (row: Row) => [text(row.id)] },
  {
    header: "Title",
    flex: true,
    minWidth: 10,
    cell: (row: Row) => [text(row.title)],
  },
  { header: "Owner", optional: true, cell: (row: Row) => [text(row.owner)] },
];

describe("layoutColumns", () => {
  it("keeps natural widths when they fit", () => {
    expect(layoutColumns([5, 20, 10], columns, 80, 2).widths).toEqual([
      5, 20, 10,
    ]);
  });

  it("shrinks the flexible column first", () => {
    const layout = layoutColumns([5, 40, 12], columns, 40, 2);
    expect(layout.visible).toEqual([0, 1, 2]);
    expect(layout.widths[1]).toBe(19);
  });

  it("drops optional columns when the flexible one hits its minimum", () => {
    const layout = layoutColumns([5, 40, 12], columns, 20, 2);
    expect(layout.visible).toEqual([0, 1]);
  });
});

describe("renderTable", () => {
  it("aligns cells and never exceeds the width", () => {
    for (const width of [30, 50, 80, 120]) {
      const lines = renderTable(ui(width), rows, columns, { width, indent: 2 });
      expect(lines).toHaveLength(2);
      for (const line of lines)
        expect(stringWidth(line)).toBeLessThanOrEqual(width);
    }
  });

  it("truncates with an ellipsis instead of wrapping", () => {
    const [first] = renderTable(ui(40), rows, columns, { width: 40 });
    expect(first).toContain("…");
  });

  it("renders a muted header when asked", () => {
    const lines = renderTable(ui(80), rows, columns, {
      width: 80,
      header: true,
    });
    expect(lines[0]).toMatch(/^ID\s+Title\s+Owner$/);
  });

  it("right aligns numeric columns", () => {
    const lines = renderTable(
      ui(80),
      [{ n: 3 }, { n: 120 }],
      [
        {
          header: "N",
          align: "right" as const,
          cell: (row: { n: number }) => [text(String(row.n))],
        },
      ],
      { width: 80 },
    );
    expect(lines).toEqual(["  3", "120"]);
  });
});
