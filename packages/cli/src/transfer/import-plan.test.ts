import { describe, expect, it } from "vite-plus/test";
import type { Column } from "../api/schemas.js";
import { planImport } from "./import-plan.js";

function column(slug: string, name: string, position: number): Column {
  return {
    id: slug,
    projectId: "p",
    slug,
    name,
    position,
    color: null,
    isFinal: false,
  };
}

const columns = [
  column("in-progress", "In Progress", 1),
  column("to-do", "To Do", 0),
  column("done", "Done", 2),
];

describe("planImport", () => {
  it("keeps known statuses and matches names to column slugs", () => {
    const plan = planImport(
      [
        { title: "a", status: "to-do", labels: 0 },
        { title: "b", status: "Done", labels: 0 },
        { title: "c", status: "planned", labels: 0 },
      ],
      columns,
    );
    expect(plan.tasks.map((task) => task.status)).toEqual([
      "to-do",
      "done",
      "planned",
    ]);
    expect(plan.remapped).toEqual([{ from: "Done", to: "done" }]);
    expect(plan.unknown).toEqual([]);
  });

  it("reports unknown statuses before importing", () => {
    const plan = planImport(
      [
        { title: "a", status: "backlog", labels: 0 },
        { title: "b", status: "backlog", labels: 0 },
        { title: "c", status: "icebox", labels: 0 },
      ],
      columns,
    );
    expect(plan.unknown).toEqual([
      { status: "backlog", count: 2 },
      { status: "icebox", count: 1 },
    ]);
    expect(plan.tasks.map((task) => task.status)).toEqual([
      "backlog",
      "backlog",
      "icebox",
    ]);
  });

  it("puts tasks without a status in the first column", () => {
    expect(
      planImport([{ title: "a", labels: 0 }], columns).tasks[0]?.status,
    ).toBe("to-do");
  });

  it("counts tasks whose labels will be dropped", () => {
    expect(
      planImport(
        [
          { title: "a", labels: 2 },
          { title: "b", labels: 0 },
        ],
        columns,
      ).withLabels,
    ).toBe(1);
  });

  it("only sends the fields the file has", () => {
    expect(
      planImport(
        [
          {
            title: "a",
            status: "done",
            dueDate: null,
            userId: "u1",
            labels: 0,
          },
        ],
        columns,
      ).tasks[0],
    ).toEqual({ title: "a", status: "done", dueDate: null, userId: "u1" });
  });
});
