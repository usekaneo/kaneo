import { describe, expect, it } from "vite-plus/test";
import type { Column, Project } from "../api/schemas.js";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { countByColumn, toProjectView } from "./project-view.js";
import { renderProjectView } from "./render-project-view.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const project: Project = {
  id: "p_kan",
  workspaceId: "ws_acme",
  slug: "kan",
  name: "Kaneo Web",
  icon: null,
  description: "The web app.\n\nShip the board first.",
  archivedAt: null,
  position: 0,
  lastTaskNumber: 7,
};

function column(
  slug: string,
  name: string,
  position: number,
  isFinal = false,
): Column {
  return {
    id: `c_${slug}`,
    projectId: "p_kan",
    name,
    slug,
    position,
    color: null,
    isFinal,
  };
}

const columns = [
  column("done", "Done", 3, true),
  column("to-do", "To Do", 0),
  column("in-progress", "In Progress", 1),
  column("in-review", "In Review", 2),
];

const statuses = [
  "to-do",
  "to-do",
  "in-progress",
  "in-progress",
  "in-review",
  "done",
  "done",
];
const tasks = statuses.map((status) => ({ status }));

describe("countByColumn", () => {
  it("counts tasks per column in board order and ignores unknown statuses", () => {
    expect(countByColumn(columns, [...tasks, { status: "planned" }])).toEqual([
      { slug: "to-do", name: "To Do", isFinal: false, taskCount: 2 },
      {
        slug: "in-progress",
        name: "In Progress",
        isFinal: false,
        taskCount: 2,
      },
      { slug: "in-review", name: "In Review", isFinal: false, taskCount: 1 },
      { slug: "done", name: "Done", isFinal: true, taskCount: 2 },
    ]);
  });
});

describe("toProjectView", () => {
  it("builds the JSON shape with the board link and total", () => {
    const view = toProjectView(
      project,
      columns,
      { tasks, total: 9 },
      "https://kaneo.test",
    );
    expect(view).toMatchObject({
      id: "p_kan",
      key: "KAN",
      name: "Kaneo Web",
      description: "The web app.\n\nShip the board first.",
      url: "https://kaneo.test/dashboard/workspace/ws_acme/project/p_kan/board",
      totalTasks: 9,
    });
    expect(view.columns).toHaveLength(4);
  });
});

describe("renderProjectView", () => {
  const view = toProjectView(
    project,
    columns,
    { tasks, total: 9 },
    "https://kaneo.test",
  );

  it("shows the header, description, and one bar per column at 80 columns", () => {
    const lines = renderProjectView(ui(80), { ...view, taskLimit: 1000 });
    expect(lines).toEqual([
      "",
      "  Kaneo Web · KAN · 9 tasks",
      "  https://kaneo.test/dashboard/workspace/ws_acme/project/p_kan/board",
      "",
      "  The web app.",
      "",
      "  Ship the board first.",
      "",
      "  ● To Do        2  ▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱",
      "  ● In Progress  2  ▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱",
      "  ● In Review    1  ▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱",
      "  ● Done         2  ▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱",
      "",
      "  2 more tasks are planned or archived.",
      "",
    ]);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });

  it("drops the bars when the terminal is too narrow", () => {
    const lines = renderProjectView(ui(20), { ...view, taskLimit: 1000 });
    expect(lines).toContain("  ● In Progress  2");
  });

  it("says when the counts stop at the task limit", () => {
    const lines = renderProjectView(ui(80), {
      ...view,
      totalTasks: 1500,
      taskLimit: 1000,
    });
    expect(lines).toContain("  Counts cover the first 1000 tasks.");
  });

  it("handles a project without columns", () => {
    const lines = renderProjectView(ui(80), {
      ...view,
      description: null,
      columns: [],
      totalTasks: 0,
      taskLimit: 1000,
    });
    expect(lines.slice(1)).toEqual([
      "  Kaneo Web · KAN · 0 tasks",
      "  https://kaneo.test/dashboard/workspace/ws_acme/project/p_kan/board",
      "",
      "  This project has no columns yet.",
      "",
    ]);
  });
});
