import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import type { TaskViewJson } from "../task-view/task-view-json.js";
import { renderTaskDetail } from "./render-task-detail.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});
const now = new Date(2026, 9, 7, 10);

const task: TaskViewJson = {
  id: "task-1",
  ticketId: "KAN-12",
  number: 12,
  title: "Fix login redirect after device approval",
  description:
    "## Steps\n\n1. Sign in with **device** flow\n2. See [the bug](https://kaneo.test/b)",
  status: "in-progress",
  statusName: "In Progress",
  priority: "urgent",
  assignee: { id: "user-1", name: "Ada Lovelace" },
  dueDate: new Date(2026, 9, 6, 12).toISOString(),
  startDate: new Date(2026, 9, 1, 12).toISOString(),
  createdAt: new Date(2026, 8, 30, 9).toISOString(),
  projectId: "project-1",
  projectKey: "KAN",
  projectName: "Kaneo Web",
  workspaceId: "workspace-1",
  url: "https://kaneo.test/dashboard/workspace/workspace-1/project/project-1/task/task-1",
  labels: [],
  parent: null,
  subtasks: [],
  relations: [],
  links: [],
  fields: [],
  time: { totalSeconds: 0, running: [] },
  comments: [],
};

describe("renderTaskDetail", () => {
  it("renders the card and the description at 80 columns", () => {
    expect(renderTaskDetail(ui, { task, statusFinal: false, now })).toEqual([
      "",
      "  KAN-12 Fix login redirect after device approval",
      "",
      "    Status     ● In Progress",
      "    Priority   ▲ Urgent",
      "    Assignee   Ada Lovelace",
      "    Labels     None",
      "    Due        ◷ Yesterday",
      "    Start      Oct 1",
      "    Created    Sep 30",
      "    Project    Kaneo Web · KAN",
      "",
      "    Steps",
      "",
      "    1. Sign in with device flow",
      "    2. See the bug (https://kaneo.test/b)",
      "",
    ]);
  });

  it("shows empty fields as muted placeholders", () => {
    const lines = renderTaskDetail(ui, {
      task: {
        ...task,
        ticketId: null,
        priority: "no-priority",
        assignee: null,
        dueDate: null,
        startDate: null,
        description: "",
      },
      statusFinal: false,
      now,
    });
    expect(lines).toEqual([
      "",
      "  task-1 Fix login redirect after device approval",
      "",
      "    Status     ● In Progress",
      "    Priority   No priority",
      "    Assignee   Unassigned",
      "    Labels     None",
      "    Due        None",
      "    Start      None",
      "    Created    Sep 30",
      "    Project    Kaneo Web · KAN",
      "",
      "    No description.",
      "",
    ]);
  });

  it("wraps long prose to the terminal and cuts long descriptions", () => {
    const paragraph = "word ".repeat(40).trim();
    const description = Array.from(
      { length: 50 },
      (_, index) => `${index + 1}. ${paragraph}`,
    ).join("\n");
    const lines = renderTaskDetail(ui, {
      task: { ...task, description },
      statusFinal: false,
      now,
    });
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
    const body = lines.slice(12);
    expect(body.filter((line) => line !== "").length).toBe(41);
    expect(lines.at(-2)).toBe(
      "    Run kaneo task open KAN-12 to read the rest.",
    );
    const full = renderTaskDetail(ui, {
      task: { ...task, description },
      statusFinal: false,
      now,
      full: true,
    });
    expect(full).toContain(`    50. ${"word ".repeat(14).trim()}`);
    expect(full.some((line) => line.includes("to read the rest"))).toBe(false);
  });
});

describe("renderTaskDetail rows", () => {
  const rows = (overrides: Partial<TaskViewJson>, columns = 80) => {
    const lines = renderTaskDetail(
      makeUi({
        color: 0,
        unicode: true,
        hyperlinks: false,
        animate: false,
        columns,
      }),
      { task: { ...task, ...overrides }, statusFinal: false, now },
    );
    return lines.slice(3, lines.indexOf("", 3));
  };

  it("shows labels as chips, tracked time with the running timer, and the parent", () => {
    expect(
      rows({
        labels: [
          { name: "bug", color: "red" },
          { name: "auth", color: "purple" },
        ],
        time: {
          totalSeconds: 9000,
          running: [
            {
              user: { id: "user-1", name: "Ada Lovelace" },
              startedAt: now.toISOString(),
            },
          ],
        },
        parent: {
          id: "task-4",
          ticketId: "KAN-4",
          title: "Auth overhaul",
          status: "to-do",
          completed: false,
          url: "https://kaneo.test/task-4",
        },
      }),
    ).toEqual([
      "    Status     ● In Progress",
      "    Priority   ▲ Urgent",
      "    Assignee   Ada Lovelace",
      "    Labels     ● bug  ● auth",
      "    Due        ◷ Yesterday",
      "    Start      Oct 1",
      "    Created    Sep 30",
      "    Time       2h 30m · ● Timer running (Ada Lovelace)",
      "    Project    Kaneo Web · KAN",
      "    Parent     ● KAN-4 Auth overhaul",
    ]);
  });

  it("hides the time row without tracked time and marks sections that failed", () => {
    const lines = rows({ labels: null, time: null });
    expect(lines).toContain("    Labels     could not load");
    expect(lines).toContain("    Time       could not load");
    expect(rows({}).some((line) => line.includes("Time"))).toBe(false);
  });

  it("cuts long label and parent rows to the terminal width", () => {
    const lines = rows(
      {
        labels: Array.from({ length: 12 }, (_, index) => ({
          name: `label-${index}`,
          color: "gray",
        })),
        parent: {
          id: "task-4",
          ticketId: "KAN-4",
          title: "A parent task with a title that is much longer than the row",
          status: "to-do",
          completed: false,
          url: "https://kaneo.test/task-4",
        },
      },
      60,
    );
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(60);
    expect(lines.find((line) => line.includes("Labels"))).toBe(
      "    Labels     ● label-0  ● label-1  ● label-2  +9",
    );
    expect(lines.find((line) => line.includes("Parent"))).toMatch(/…$/u);
  });
});
