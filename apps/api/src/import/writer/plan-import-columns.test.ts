import { describe, expect, it } from "vite-plus/test";
import { planImportColumns } from "./plan-import-columns";

function column(key: string, name: string, isFinal = false) {
  return { key, name, isFinal };
}

describe("planImportColumns", () => {
  it("keeps names, order and the final flag", () => {
    expect(
      planImportColumns([
        column("a", "Backlog"),
        column("b", " In Progress "),
        column("c", "Shipped", true),
      ]),
    ).toEqual({
      columns: [
        {
          key: "a",
          name: "Backlog",
          slug: "backlog",
          position: 0,
          isFinal: false,
        },
        {
          key: "b",
          name: "In Progress",
          slug: "in-progress",
          position: 1,
          isFinal: false,
        },
        {
          key: "c",
          name: "Shipped",
          slug: "shipped",
          position: 2,
          isFinal: true,
        },
      ],
      warnings: [],
    });
  });

  it("names columns without letters or numbers Untitled", () => {
    const plan = planImportColumns([column("a", "???"), column("b", "")]);

    expect(plan.columns.map(({ name, slug }) => ({ name, slug }))).toEqual([
      { name: "Untitled", slug: "untitled" },
      { name: "Untitled 2", slug: "untitled-2" },
    ]);
    expect(plan.warnings).toEqual([
      'Renamed a column to avoid conflicts: "???" to "Untitled".',
    ]);
  });

  it("moves reserved virtual statuses out of the way", () => {
    const plan = planImportColumns([
      column("a", "Planned"),
      column("b", "archived"),
    ]);

    expect(plan.columns.map(({ name, slug }) => ({ name, slug }))).toEqual([
      { name: "Planned list", slug: "planned-list" },
      { name: "archived list", slug: "archived-list" },
    ]);
  });

  it("numbers duplicate slugs", () => {
    const plan = planImportColumns([
      column("a", "Done"),
      column("b", "done"),
      column("c", "DONE!"),
      column("d", "In-Progress"),
      column("e", "In Progress"),
    ]);

    expect(plan.columns.map(({ name }) => name)).toEqual([
      "Done",
      "done 2",
      "DONE! 3",
      "In-Progress",
      "In Progress 2",
    ]);
    expect(new Set(plan.columns.map(({ slug }) => slug)).size).toBe(5);
    expect(plan.warnings).toEqual([
      'Renamed 3 columns to avoid conflicts: "done" to "done 2", "DONE!" to "DONE! 3", "In Progress" to "In Progress 2".',
    ]);
  });

  it("returns nothing for a source without columns", () => {
    expect(planImportColumns([])).toEqual({ columns: [], warnings: [] });
  });
});
