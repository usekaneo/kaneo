import { describe, expect, it } from "vite-plus/test";
import type { Column } from "../api/schemas.js";
import { planImport } from "./import-plan.js";
import { buildImportReport } from "./import-report.js";

const columns: Column[] = [
  {
    id: "c1",
    projectId: "p1",
    slug: "to-do",
    name: "To Do",
    position: 0,
    color: null,
    isFinal: false,
  },
];

const project = {
  id: "p1",
  slug: "kan",
  name: "Kaneo Web",
  workspaceId: "w1",
};

const plan = planImport(
  [
    { title: "One", status: "to-do", labels: 1 },
    { title: "Two", status: "backlog", labels: 0 },
  ],
  columns,
);

describe("buildImportReport", () => {
  it("describes a dry run without results", () => {
    const report = buildImportReport({
      project,
      columns,
      webUrl: "https://kaneo.test",
      plan,
      outcomes: null,
    });
    expect(report).toMatchObject({
      project: { id: "p1", key: "KAN", name: "Kaneo Web" },
      dryRun: true,
      total: 2,
      imported: 0,
      failed: 0,
      unknownStatuses: ["backlog"],
      tasksWithLabels: 1,
    });
    expect(
      report.tasks.map((task) => [task.statusName, task.imported]),
    ).toEqual([
      ["To Do", null],
      ["Planned", null],
    ]);
  });

  it("reports each task's outcome with its ticket id", () => {
    const report = buildImportReport({
      project,
      columns,
      webUrl: "https://kaneo.test",
      plan,
      outcomes: [
        {
          success: true,
          task: { id: "t1", number: 7, title: "One", status: "to-do" },
        },
        { success: false, error: "Not a member", task: { title: "Two" } },
      ],
    });
    expect(report.imported).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.tasks[0]).toMatchObject({
      imported: true,
      ticketId: "KAN-7",
      url: "https://kaneo.test/dashboard/workspace/w1/project/p1/task/t1",
    });
    expect(report.tasks[1]).toMatchObject({
      imported: false,
      ticketId: null,
      error: "Not a member",
    });
  });
});
