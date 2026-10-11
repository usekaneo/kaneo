import { describe, expect, it } from "vite-plus/test";
import type { JiraIssue, JiraStatus } from "./api-types.js";
import { mapJiraProject } from "./project.js";
import { BOARD_UNAVAILABLE_WARNING } from "./warnings.js";

const BACKLOG: JiraStatus = {
  id: "1",
  name: "Backlog",
  statusCategory: { key: "new" },
};
const TODO: JiraStatus = {
  id: "2",
  name: "To Do",
  statusCategory: { key: "new" },
};
const DOING: JiraStatus = {
  id: "3",
  name: "In Progress",
  statusCategory: { key: "indeterminate" },
};
const DONE: JiraStatus = {
  id: "4",
  name: "Done",
  statusCategory: { key: "done" },
};

function issue(
  id: string,
  status: JiraStatus,
  fields: JiraIssue["fields"] = {},
): JiraIssue {
  return {
    id,
    key: `ABC-${id}`,
    fields: { summary: `Issue ${id}`, status, ...fields },
  };
}

const ISSUES = [
  issue("10", DONE, { attachment: [{}], parent: { id: "11" } }),
  issue("11", DOING, { labels: ["ux"] }),
  issue("12", BACKLOG),
  issue("13", TODO, {
    attachment: [],
    issuelinks: [
      { type: { name: "Blocks" }, outwardIssue: { id: "11" } },
      { type: { name: "Relates" }, outwardIssue: { id: "999" } },
    ],
  }),
  issue("14", DOING),
];

function project(
  overrides: Partial<Parameters<typeof mapJiraProject>[0]> = {},
) {
  return mapJiraProject({
    baseUrl: "https://acme.atlassian.net",
    project: { id: "100", key: "ABC", name: " Alpha ", description: " Core " },
    statusGroups: [{ name: "Task", statuses: [BACKLOG, TODO, DOING, DONE] }],
    boardColumns: [
      { name: "Backlog", statuses: [{ id: "1" }] },
      { name: "To Do", statuses: [{ id: "2" }] },
      { name: "In Progress", statuses: [{ id: "3" }] },
      { name: "Done", statuses: [{ id: "4" }] },
    ],
    boardUnavailable: false,
    issues: ISSUES,
    comments: new Map([
      [
        "11",
        [
          {
            author: { displayName: "Ada" },
            renderedBody: "<p>Looks good</p>",
            created: "2024-01-02T00:00:00.000+0000",
          },
        ],
      ],
    ]),
    ...overrides,
  });
}

describe("mapJiraProject", () => {
  it("places issues in board columns, backlog first, keeping rank order", () => {
    const result = project();

    expect(result.name).toBe("Alpha");
    expect(result.key).toBe("ABC");
    expect(result.description).toBe("Core");
    expect(result.columns).toEqual([
      { key: "column-2", name: "To Do", isFinal: false },
      { key: "column-3", name: "In Progress", isFinal: false },
      { key: "column-4", name: "Done", isFinal: true },
    ]);
    expect(result.tasks.map((task) => [task.key, task.columnKey])).toEqual([
      ["12", null],
      ["13", "column-2"],
      ["11", "column-3"],
      ["14", "column-3"],
      ["10", "column-4"],
    ]);
    expect(result.tasks.find((task) => task.key === "11")?.comments).toEqual([
      {
        author: { name: "Ada" },
        body: "Looks good",
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ]);
    expect(result.labels.map((label) => label.key)).toEqual(["ux"]);
    expect(result.relations).toEqual([
      { sourceKey: "11", targetKey: "10", type: "subtask" },
      { sourceKey: "13", targetKey: "11", type: "blocks" },
    ]);
    expect(result.warnings).toEqual([
      "1 issue has attachments, which are not imported.",
      "1 parent or issue link points to another project, so it was not imported.",
    ]);
  });

  it("falls back to status columns and warns when the board was not shared", () => {
    const result = project({ boardColumns: null, boardUnavailable: true });

    expect(result.columns).toEqual([
      { key: "2", name: "To Do", isFinal: false },
      { key: "3", name: "In Progress", isFinal: false },
      { key: "4", name: "Done", isFinal: true },
    ]);
    expect(result.tasks.map((task) => task.columnKey)).toEqual([
      null,
      "2",
      "3",
      "3",
      "4",
    ]);
    expect(result.warnings).toContain(BOARD_UNAVAILABLE_WARNING);
  });

  it("uses statuses quietly when the project has no board", () => {
    const result = project({ boardColumns: null, issues: [] });
    expect(result.columns.map((column) => column.key)).toEqual(["2", "3", "4"]);
    expect(result.tasks).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("uses statuses when the board has no usable columns", () => {
    const result = project({
      boardColumns: [{ name: "Backlog", statuses: [{ id: "1" }] }],
      issues: [],
    });
    expect(result.columns.map((column) => column.key)).toEqual(["2", "3", "4"]);
  });

  it("falls back to the key when the project has no name", () => {
    const result = project({
      project: { id: "100", key: "ABC", name: " " },
      issues: [],
    });
    expect(result.name).toBe("ABC");
    expect(result).not.toHaveProperty("description");
  });
});
