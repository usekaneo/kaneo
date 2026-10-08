import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import type { ActivityEntry } from "./describe-activity.js";
import { renderActivity } from "./render-activity.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const now = new Date(2026, 9, 8, 15, 0);

const entry = (overrides: Partial<ActivityEntry>): ActivityEntry => ({
  id: "a1",
  type: "created",
  actor: { id: "u1", name: "Ada Lovelace" },
  message: "created the task",
  summary: "created the task",
  detail: null,
  createdAt: new Date(2026, 9, 5, 9, 0).toISOString(),
  ...overrides,
});

const view = {
  label: "KAN-3",
  title: "Fix login redirect",
  url: "https://kaneo.test/task/1",
  more: false,
  now,
};

describe("renderActivity", () => {
  it("lists events with relative times and actors", () => {
    expect(
      renderActivity(ui(80), {
        ...view,
        entries: [
          entry({}),
          entry({
            id: "a2",
            type: "status_changed",
            summary: "changed status from To Do to In Progress",
            createdAt: new Date(2026, 9, 7, 9, 0).toISOString(),
          }),
          entry({
            id: "a3",
            type: "comment",
            actor: { id: "u2", name: "Grace Hopper" },
            summary: "commented",
            detail: "Looks good",
            createdAt: new Date(2026, 9, 8, 12, 0).toISOString(),
          }),
          entry({ id: "a4", actor: null, summary: "removed the assignee" }),
        ],
      }),
    ).toEqual([
      "",
      "  KAN-3 Fix login redirect · Activity",
      "",
      "  3d ago     Ada Lovelace created the task",
      "  Yesterday  Ada Lovelace changed status from To Do to In Progress",
      "  3h ago     Grace Hopper commented: Looks good",
      "  3d ago     Someone removed the assignee",
      "",
    ]);
  });

  it("truncates long events to the terminal width", () => {
    const lines = renderActivity(ui(80), {
      ...view,
      entries: [
        entry({
          type: "comment",
          summary: "commented",
          detail: "x ".repeat(80),
        }),
      ],
    });
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
    expect(lines[3]?.endsWith("…")).toBe(true);
  });

  it("says when older events are hidden", () => {
    expect(
      renderActivity(ui(80), { ...view, more: true, entries: [entry({})] })[3],
    ).toBe("  Showing the latest event. Pass --limit to see more.");
  });

  it("handles a task without activity", () => {
    expect(renderActivity(ui(80), { ...view, entries: [] })).toEqual([
      "",
      "  KAN-3 Fix login redirect · Activity",
      "",
      "  No activity yet.",
      "",
    ]);
  });
});
