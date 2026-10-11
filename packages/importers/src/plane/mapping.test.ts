import { describe, expect, it } from "vite-plus/test";
import type {
  PlaneComment,
  PlaneLabel,
  PlaneMember,
  PlaneState,
  PlaneWorkItem,
} from "./client.js";
import {
  MEMBERS_WARNING,
  mapColumns,
  mapPlaneProject,
  mapPriority,
  toHexColor,
  toPerson,
  uniqueById,
} from "./mapping.js";

const states: PlaneState[] = [
  { id: "s-done", name: "Done", group: "completed", sequence: 50000 },
  { id: "s-todo", name: "Todo", group: "unstarted", sequence: 25000 },
  { id: "s-cancel", name: "Cancelled", group: "cancelled", sequence: 60000 },
  { id: "s-review", name: "In Review", group: "started", sequence: 45000 },
  { id: "s-progress", name: "In Progress", group: "started", sequence: 35000 },
  { id: "s-backlog", name: "Backlog", group: "backlog", sequence: 15000 },
  { id: "s-triage", name: "Triage", group: "triage", sequence: 10 },
];

const members: PlaneMember[] = [
  {
    id: "u-jane",
    email: "jane@example.com",
    display_name: "jane",
    first_name: "Jane",
    last_name: "Doe",
  },
  {
    id: "u-bob",
    email: "bob@example.com",
    display_name: "bob",
    first_name: "",
    last_name: "",
  },
];

const labels: PlaneLabel[] = [
  { id: "l-bug", name: "Bug", color: "#FF0000" },
  { id: "l-ui", name: "UI", color: "" },
  { id: "l-unused", name: "Unused", color: "#00ff00" },
];

function item(
  overrides: Partial<PlaneWorkItem> & { id: string },
): PlaneWorkItem {
  return {
    name: overrides.id,
    description_html: "<p></p>",
    priority: "none",
    state: "s-todo",
    assignees: [],
    labels: [],
    parent: null,
    sort_order: 65535,
    ...overrides,
  };
}

function project(
  workItems: PlaneWorkItem[],
  options: {
    members?: PlaneMember[] | null;
    comments?: Map<string, PlaneComment[]>;
  } = {},
) {
  return mapPlaneProject({
    project: {
      id: "p1",
      name: " Website ",
      identifier: "WEB",
      description: "Marketing site",
    },
    states,
    labels,
    members: options.members === undefined ? members : options.members,
    workItems,
    comments: options.comments ?? new Map(),
  });
}

describe("mapColumns", () => {
  it("orders states by group then sequence and marks final groups", () => {
    expect(mapColumns(states)).toEqual([
      { key: "s-todo", name: "Todo", isFinal: false },
      { key: "s-progress", name: "In Progress", isFinal: false },
      { key: "s-review", name: "In Review", isFinal: false },
      { key: "s-done", name: "Done", isFinal: true },
      { key: "s-cancel", name: "Cancelled", isFinal: true },
    ]);
  });

  it("puts unknown groups last", () => {
    expect(
      mapColumns([
        { id: "x", name: "Mystery", group: "custom", sequence: 1 },
        { id: "a", name: "Todo", group: "unstarted", sequence: 2 },
      ]).map((column) => column.key),
    ).toEqual(["a", "x"]);
  });
});

describe("mapPriority", () => {
  it.each([
    ["urgent", "urgent"],
    ["high", "high"],
    ["medium", "medium"],
    ["low", "low"],
    ["none", "no-priority"],
    [null, "no-priority"],
    ["whatever", "no-priority"],
  ])("maps %s to %s", (input, expected) => {
    expect(mapPriority(input)).toBe(expected);
  });
});

describe("toHexColor", () => {
  it("normalizes hex colors and falls back to gray", () => {
    expect(toHexColor("#FF0000")).toBe("#ff0000");
    expect(toHexColor("0f0")).toBe("#00ff00");
    expect(toHexColor("")).toBe("#6b7280");
    expect(toHexColor(null)).toBe("#6b7280");
    expect(toHexColor("red")).toBe("#6b7280");
  });
});

describe("toPerson", () => {
  it("prefers the full name and falls back to the display name", () => {
    expect(toPerson(members[0] as PlaneMember)).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
    });
    expect(toPerson(members[1] as PlaneMember)).toEqual({
      name: "bob",
      email: "bob@example.com",
    });
  });
});

describe("uniqueById", () => {
  it("drops work items repeated across pages", () => {
    expect(
      uniqueById([{ id: "a" }, { id: "b" }, { id: "a" }]).map((x) => x.id),
    ).toEqual(["a", "b"]);
  });
});

describe("mapPlaneProject", () => {
  it("orders tasks by column then sort order and maps fields", () => {
    const result = project([
      item({ id: "done", state: "s-done", sort_order: 1 }),
      item({ id: "todo-b", state: "s-todo", sort_order: 200 }),
      item({
        id: "todo-a",
        name: "  Write copy ",
        state: "s-todo",
        sort_order: 100,
        priority: "high",
        description_html: "<h2>Plan</h2><ul><li><p>draft</p></li></ul>",
        start_date: "2026-01-05",
        target_date: "2026-01-09",
        created_at: "2026-01-01T10:00:00.000000Z",
        sequence_id: 12,
      }),
      item({ id: "stateless", state: null }),
      item({ id: "backlog", state: "s-backlog" }),
      item({ id: "old", state: "s-done", archived_at: "2026-02-01T00:00:00Z" }),
    ]);

    expect(result.name).toBe("Website");
    expect(result.key).toBe("WEB");
    expect(result.description).toBe("Marketing site");
    expect(result.tasks.map((task) => task.key)).toEqual([
      "todo-a",
      "todo-b",
      "done",
      "old",
      "stateless",
      "backlog",
    ]);
    expect(
      result.tasks.find((task) => task.key === "backlog")?.columnKey,
    ).toBeNull();
    expect(result.tasks[0]).toEqual({
      key: "todo-a",
      number: 12,
      columnKey: "s-todo",
      title: "Write copy",
      description: "## Plan\n\n- draft",
      priority: "high",
      startDate: "2026-01-05T00:00:00.000Z",
      dueDate: "2026-01-09T00:00:00.000Z",
      createdAt: "2026-01-01T10:00:00.000Z",
      labelKeys: [],
      comments: [],
    });
    const byKey = (key: string) =>
      result.tasks.find((task) => task.key === key);
    expect(byKey("done")?.number).toBeUndefined();
    expect(byKey("old")?.archived).toBe(true);
    expect(byKey("todo-a")?.archived).toBeUndefined();
    expect(byKey("stateless")?.columnKey).toBeNull();
  });

  it("keeps the first assignee and counts work items with more", () => {
    const result = project([
      item({ id: "a", assignees: ["u-jane", "u-bob"] }),
      item({ id: "b", assignees: ["u-bob", "u-jane", "u-x"] }),
      item({ id: "c", assignees: ["u-unknown"] }),
      item({ id: "d", assignees: ["u-bob"] }),
    ]);

    expect(result.tasks.map((task) => task.assignee)).toEqual([
      { name: "Jane Doe", email: "jane@example.com" },
      { name: "bob", email: "bob@example.com" },
      undefined,
      { name: "bob", email: "bob@example.com" },
    ]);
    expect(result.warnings).toContain(
      "2 work items have more than one assignee. Kaneo keeps one assignee per task, so only the first was assigned.",
    );
  });

  it("uses expanded assignees when the member list is unavailable", () => {
    const result = project(
      [
        item({
          id: "a",
          assignees: [
            {
              id: "u-z",
              display_name: "zed",
              first_name: "Zed",
              last_name: "",
            },
          ],
        }),
      ],
      { members: null },
    );
    expect(result.tasks[0]?.assignee).toEqual({ name: "Zed" });
    expect(result.warnings).toContain(MEMBERS_WARNING);
  });

  it("only includes labels used by tasks, with hex colors", () => {
    const result = project([
      item({ id: "a", labels: ["l-ui", "l-bug", "l-missing", "l-ui"] }),
    ]);
    expect(result.tasks[0]?.labelKeys).toEqual(["l-ui", "l-bug"]);
    expect(result.labels).toEqual([
      { key: "l-bug", name: "Bug", color: "#ff0000" },
      { key: "l-ui", name: "UI", color: "#6b7280" },
    ]);
  });

  it("turns parents in the project into subtask relations", () => {
    const result = project([
      item({ id: "parent" }),
      item({ id: "child", parent: "parent" }),
      item({ id: "orphan", parent: "elsewhere" }),
      item({ id: "self", parent: "self" }),
    ]);
    expect(result.relations).toEqual([
      { sourceKey: "parent", targetKey: "child", type: "subtask" },
    ]);
  });

  it("maps comments oldest first with Markdown bodies and authors", () => {
    const comments = new Map<string, PlaneComment[]>([
      [
        "a",
        [
          {
            id: "c2",
            comment_html: "<p>Second <strong>reply</strong></p>",
            created_at: "2026-03-02T09:00:00Z",
            actor: { id: "u-jane", display_name: "jane" },
          },
          {
            id: "c1",
            comment_html:
              '<p>First, cc <mention-component entity_identifier="u-bob" entity_name="user_mention"></mention-component></p>',
            created_at: "2026-03-01T09:00:00Z",
            actor: "u-bob",
          },
          {
            id: "c3",
            comment_html: "<p></p>",
            created_at: "2026-03-03T09:00:00Z",
            actor: "u-bob",
          },
          {
            id: "c4",
            comment_html: "<p>From a guest</p>",
            created_at: "2026-03-04T09:00:00Z",
            actor: {
              id: "u-guest",
              display_name: "",
              first_name: "",
              last_name: "",
            },
          },
        ],
      ],
    ]);

    const result = project([item({ id: "a" })], { comments });
    expect(result.tasks[0]?.comments).toEqual([
      {
        author: { name: "bob", email: "bob@example.com" },
        body: "First, cc @bob",
        createdAt: "2026-03-01T09:00:00.000Z",
      },
      {
        author: { name: "Jane Doe", email: "jane@example.com" },
        body: "Second **reply**",
        createdAt: "2026-03-02T09:00:00.000Z",
      },
      {
        author: { name: "Plane user" },
        body: "From a guest",
        createdAt: "2026-03-04T09:00:00.000Z",
      },
    ]);
  });

  it("has no warnings when nothing was dropped", () => {
    const result = project([item({ id: "a", assignees: ["u-jane"] })]);
    expect(result.warnings).toEqual([]);
  });

  it("leaves the key out when the project has no identifier", () => {
    const result = mapPlaneProject({
      project: { id: "p1", name: "Website", identifier: "  " },
      states,
      labels,
      members,
      workItems: [],
      comments: new Map(),
    });
    expect(result).not.toHaveProperty("key");
  });
});
