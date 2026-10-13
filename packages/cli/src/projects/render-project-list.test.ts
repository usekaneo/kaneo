import { describe, expect, it } from "vite-plus/test";
import type { ProjectSummary } from "../api/project-summaries.js";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { type ProjectJson, toProjectJson } from "./project-json.js";
import { renderProjectList } from "./render-project-list.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const now = new Date(2026, 9, 7, 12);

function summary(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: "p_kan",
    workspaceId: "ws_acme",
    slug: "kan",
    name: "Kaneo Web",
    description: null,
    archivedAt: null,
    statistics: { totalTasks: 7, completionPercentage: 14, dueDate: null },
    ...overrides,
  };
}

const kan = toProjectJson(
  summary({
    statistics: {
      totalTasks: 7,
      completionPercentage: 14,
      dueDate: new Date(2026, 9, 20, 12).toISOString(),
    },
  }),
  "https://kaneo.test",
);
const mob = toProjectJson(
  summary({
    id: "p_mob",
    slug: "mob",
    name: "Mobile App",
    statistics: { totalTasks: 0, completionPercentage: 0, dueDate: null },
  }),
  "https://kaneo.test",
);
const old = toProjectJson(
  summary({
    id: "p_old",
    slug: "old",
    name: "Old Site",
    archivedAt: "2026-01-01T00:00:00.000Z",
    statistics: { totalTasks: 1, completionPercentage: 100, dueDate: null },
  }),
  "https://kaneo.test",
);

describe("toProjectJson", () => {
  it("exposes a stable shape with the key and board link", () => {
    expect(kan).toEqual({
      id: "p_kan",
      key: "KAN",
      name: "Kaneo Web",
      slug: "kan",
      workspaceId: "ws_acme",
      archived: false,
      totalTasks: 7,
      completion: 14,
      dueDate: new Date(2026, 9, 20, 12).toISOString(),
      url: "https://kaneo.test/dashboard/workspace/ws_acme/project/p_kan/board",
    } satisfies ProjectJson);
    expect(old.archived).toBe(true);
  });
});

describe("renderProjectList", () => {
  it("renders key, name, tasks, progress and due date at 80 columns", () => {
    const lines = renderProjectList(ui(80), {
      projects: [old, kan, mob],
      includeArchived: true,
      now,
    });
    expect(lines).toEqual([
      "",
      "  KAN   Kaneo Web              7 tasks   ▰▱▱▱▱▱▱▱▱▱  14%   ◷ Oct 20",
      "  MOB   Mobile App            no tasks",
      "  OLD   Old Site · archived     1 task   ▰▰▰▰▰▰▰▰▰▰ 100%",
      "",
    ]);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });

  it("drops the optional columns on a narrow terminal instead of wrapping", () => {
    const lines = renderProjectList(ui(30), {
      projects: [kan, mob],
      includeArchived: false,
      now,
    });
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(30);
    expect(lines[1]).toContain("KAN");
    expect(lines[1]).not.toContain("◷");
  });

  it("explains an empty list", () => {
    expect(
      renderProjectList(ui(80), { projects: [], includeArchived: false, now }),
    ).toEqual(["", "  No active projects in this workspace.", ""]);
  });
});
