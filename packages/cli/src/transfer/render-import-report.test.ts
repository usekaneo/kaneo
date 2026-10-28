import { describe, expect, it } from "vite-plus/test";
import type { Column } from "../api/schemas.js";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { planImport } from "./import-plan.js";
import { buildImportReport } from "./import-report.js";
import {
  renderImportReport,
  renderImportWarnings,
} from "./render-import-report.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

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

const project = { id: "p1", slug: "kan", name: "Kaneo Web", workspaceId: "w1" };

const plan = planImport(
  [
    { title: "Fix login redirect", status: "To Do", labels: 2 },
    { title: "Old idea", status: "backlog", labels: 0 },
  ],
  columns,
);

describe("renderImportWarnings", () => {
  it("lists unknown statuses, matched statuses and dropped labels", () => {
    const report = buildImportReport({
      project,
      columns,
      webUrl: "https://kaneo.test",
      plan,
      outcomes: null,
    });
    expect(renderImportWarnings(ui, report)).toEqual([
      "  ▲ 1 task uses a status Kaneo Web does not have (backlog); it lands in Planned.",
      "  ● Statuses matched to columns: To Do → to-do",
      "  ▲ Labels are not imported; 1 task in the file has labels.",
    ]);
  });
});

describe("renderImportReport", () => {
  it("shows a dry run at 80 columns", () => {
    const lines = renderImportReport(
      ui,
      buildImportReport({
        project,
        columns,
        webUrl: "https://kaneo.test",
        plan,
        outcomes: null,
      }),
    );
    expect(lines).toEqual([
      "",
      "  ● Dry run: 2 tasks would be imported into Kaneo Web · KAN",
      "",
      "  ▲ 1 task uses a status Kaneo Web does not have (backlog); it lands in Planned.",
      "  ● Statuses matched to columns: To Do → to-do",
      "  ▲ Labels are not imported; 1 task in the file has labels.",
      "",
      "    1  To Do    Fix login redirect",
      "    2  Planned  Old idea",
      "",
      "  Nothing was imported. Run it again without --dry-run to import.",
      "",
    ]);
  });

  it("marks each imported and failed task", () => {
    const lines = renderImportReport(
      ui,
      buildImportReport({
        project,
        columns,
        webUrl: "https://kaneo.test",
        plan,
        outcomes: [
          {
            success: true,
            task: {
              id: "t1",
              number: 7,
              title: "Fix login redirect",
              status: "to-do",
            },
          },
          {
            success: false,
            error:
              "Assignee is not a member of this workspace, and the rest of this long message",
            task: { title: "Old idea" },
          },
        ],
      }),
    );
    expect(lines[1]).toBe(
      "  ✗ Imported 1 of 2 tasks into Kaneo Web · KAN; 1 failed",
    );
    expect(lines[3]).toBe("    ✓  KAN-7  To Do    Fix login redirect");
    expect(lines[4]).toBe(
      "    ✗         Planned  Old idea            Assignee is not a member of this wor…",
    );
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });
});
