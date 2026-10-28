import { describe, expect, it } from "vite-plus/test";
import type {
  LinearComment,
  LinearIssue,
  LinearLabel,
  LinearTeam,
  LinearWorkflowState,
} from "./client.js";
import { mapColumns } from "./columns.js";
import { groupComments } from "./comments.js";
import { mapLabels, toHexColor } from "./labels.js";
import {
  buildWarnings,
  mapIssue,
  mapPriority,
  mapTeam,
  sortIssues,
} from "./mapping.js";
import { mapRelations } from "./relations.js";

function issue(id: string, overrides: Partial<LinearIssue> = {}): LinearIssue {
  return {
    id,
    number: 1,
    title: `Issue ${id}`,
    description: null,
    priority: 0,
    dueDate: null,
    sortOrder: 0,
    createdAt: null,
    state: { id: "todo" },
    assignee: null,
    parent: null,
    labels: { nodes: [], pageInfo: { hasNextPage: false } },
    relations: { nodes: [], pageInfo: { hasNextPage: false } },
    ...overrides,
  };
}

function withLabels(...nodes: LinearLabel[]): LinearIssue["labels"] {
  return { nodes, pageInfo: { hasNextPage: false } };
}

function withRelations(
  ...nodes: Array<[string, string]>
): LinearIssue["relations"] {
  return {
    nodes: nodes.map(([type, id]) => ({ type, relatedIssue: { id } })),
    pageInfo: { hasNextPage: false },
  };
}

function state(
  id: string,
  type: string,
  position: number,
): LinearWorkflowState {
  return { id, name: id, type, position, color: "#000000" };
}

const STATES = [
  state("done", "completed", 0),
  state("canceled", "canceled", 0),
  state("in-review", "started", 2),
  state("todo", "unstarted", 0),
  state("in-progress", "started", 1),
  state("backlog", "backlog", 0),
  state("triage", "triage", 0),
  state("duplicate", "duplicate", 0),
];

describe("mapColumns", () => {
  it("orders states by type group then position and marks final states", () => {
    expect(mapColumns(STATES, new Set(["triage", "duplicate"]))).toEqual([
      { key: "todo", name: "todo", isFinal: false },
      { key: "in-progress", name: "in-progress", isFinal: false },
      { key: "in-review", name: "in-review", isFinal: false },
      { key: "done", name: "done", isFinal: true },
      { key: "canceled", name: "canceled", isFinal: true },
      { key: "duplicate", name: "duplicate", isFinal: true },
    ]);
  });

  it("leaves backlog and triage states to the Kaneo backlog instead of columns", () => {
    expect(
      mapColumns(STATES, new Set(["triage", "backlog"])).map(
        (column) => column.key,
      ),
    ).not.toEqual(expect.arrayContaining(["triage"]));
    expect(
      mapColumns(STATES, new Set(["backlog"])).map((column) => column.key),
    ).not.toContain("backlog");
  });

  it("skips duplicate states without issues but keeps other empty states", () => {
    expect(mapColumns(STATES, new Set()).map((column) => column.key)).toEqual([
      "todo",
      "in-progress",
      "in-review",
      "done",
      "canceled",
    ]);
  });
});

describe("mapPriority", () => {
  it("maps Linear priority numbers", () => {
    expect(mapPriority(0)).toBe("no-priority");
    expect(mapPriority(1)).toBe("urgent");
    expect(mapPriority(2)).toBe("high");
    expect(mapPriority(3)).toBe("medium");
    expect(mapPriority(4)).toBe("low");
    expect(mapPriority(null)).toBe("no-priority");
    expect(mapPriority(7)).toBe("no-priority");
  });
});

describe("toHexColor", () => {
  it("normalizes hex colors and falls back to gray", () => {
    expect(toHexColor("#BEC2C8")).toBe("#bec2c8");
    expect(toHexColor("#abc")).toBe("#aabbcc");
    expect(toHexColor("blue")).toBe("#6b7280");
    expect(toHexColor(null)).toBe("#6b7280");
  });
});

describe("mapLabels", () => {
  it("keeps only used labels and qualifies names shared by two labels", () => {
    const bug = { id: "l-bug", name: "Bug", color: "#EB5757", parent: null };
    const frontend = {
      id: "l-fe",
      name: "Frontend",
      color: "#4ea7fc",
      parent: { name: "Area" },
    };
    const backendBug = {
      id: "l-bbug",
      name: "bug",
      color: "not-a-color",
      parent: { name: "Backend" },
    };
    const labels = mapLabels([
      issue("a", { labels: withLabels(bug, frontend) }),
      issue("b", { labels: withLabels(backendBug, bug) }),
    ]);

    expect(labels).toEqual([
      { key: "l-bbug", name: "Backend: bug", color: "#6b7280" },
      { key: "l-bug", name: "Bug", color: "#eb5757" },
      { key: "l-fe", name: "Frontend", color: "#4ea7fc" },
    ]);
  });
});

describe("mapRelations", () => {
  it("maps parents, blocks and related links once, inside the team only", () => {
    const relations = mapRelations([
      issue("parent", {
        relations: withRelations(["blocks", "child"], ["related", "other"]),
      }),
      issue("child", {
        parent: { id: "parent" },
        relations: withRelations(
          ["related", "other"],
          ["similar", "parent"],
          ["blocks", "outside"],
        ),
      }),
      issue("other", {
        relations: withRelations(["related", "child"], ["duplicate", "parent"]),
      }),
      issue("orphan", { parent: { id: "outside-parent" } }),
    ]);

    expect(relations).toEqual([
      { sourceKey: "parent", targetKey: "child", type: "blocks" },
      { sourceKey: "parent", targetKey: "other", type: "related" },
      { sourceKey: "parent", targetKey: "child", type: "subtask" },
      { sourceKey: "child", targetKey: "other", type: "related" },
      { sourceKey: "child", targetKey: "parent", type: "related" },
    ]);
  });
});

describe("groupComments", () => {
  it("groups comments per issue oldest first with user, bot and fallback authors", () => {
    const comments: LinearComment[] = [
      {
        body: "Second",
        createdAt: "2024-03-02T10:00:00.000Z",
        user: null,
        botActor: { name: "GitHub" },
        issue: { id: "a" },
      },
      {
        body: "First",
        createdAt: "2024-03-01T10:00:00.000Z",
        user: { name: "Ada Lovelace", email: "ada@example.com" },
        botActor: null,
        issue: { id: "a" },
      },
      {
        body: "Elsewhere",
        createdAt: "2024-03-03T10:00:00.000Z",
        user: null,
        botActor: null,
        issue: { id: "b" },
      },
    ];

    const grouped = groupComments(comments);

    expect(grouped.get("a")).toEqual([
      {
        author: { name: "Ada Lovelace", email: "ada@example.com" },
        body: "First",
        createdAt: "2024-03-01T10:00:00.000Z",
      },
      {
        author: { name: "GitHub" },
        body: "Second",
        createdAt: "2024-03-02T10:00:00.000Z",
      },
    ]);
    expect(grouped.get("b")?.[0]?.author).toEqual({ name: "Linear" });
  });
});

describe("mapIssue", () => {
  it("maps fields and keeps the description as is", () => {
    const task = mapIssue(
      issue("a", {
        number: 123,
        title: "Fix login",
        description: "Steps:\n\n- open app",
        priority: 2,
        dueDate: "2024-05-01",
        createdAt: "2024-04-01T08:30:00.000Z",
        state: { id: "todo" },
        assignee: { name: "Ada Lovelace", email: "ada@example.com" },
        labels: withLabels({
          id: "l-bug",
          name: "Bug",
          color: "#eb5757",
          parent: null,
        }),
      }),
      new Set(["todo"]),
      [],
    );

    expect(task).toEqual({
      key: "a",
      number: 123,
      columnKey: "todo",
      title: "Fix login",
      description: "Steps:\n\n- open app",
      priority: "high",
      dueDate: "2024-05-01T00:00:00.000Z",
      createdAt: "2024-04-01T08:30:00.000Z",
      assignee: { name: "Ada Lovelace", email: "ada@example.com" },
      labelKeys: ["l-bug"],
      comments: [],
    });
  });

  it("uses no column when the state is not imported", () => {
    const task = mapIssue(issue("a", { state: { id: "gone" } }), new Set(), []);
    expect(task.columnKey).toBeNull();
    expect(task.assignee).toBeUndefined();
  });
});

describe("sortIssues", () => {
  it("orders by state column then sort order", () => {
    const ordered = sortIssues(
      [
        issue("done-1", { state: { id: "done" }, sortOrder: -5 }),
        issue("todo-2", { state: { id: "todo" }, sortOrder: 20 }),
        issue("backlog-1", { state: { id: "backlog" }, sortOrder: 99 }),
        issue("todo-1", { state: { id: "todo" }, sortOrder: -3.5 }),
        issue("unknown", { state: { id: "missing" } }),
      ],
      STATES,
    );
    expect(ordered.map((item) => item.id)).toEqual([
      "backlog-1",
      "todo-1",
      "todo-2",
      "done-1",
      "unknown",
    ]);
  });
});

describe("buildWarnings", () => {
  it("only warns about data that was cut off", () => {
    expect(buildWarnings([issue("a")])).toEqual([]);

    const truncated = issue("b", {
      labels: { nodes: [], pageInfo: { hasNextPage: true } },
      relations: { nodes: [], pageInfo: { hasNextPage: true } },
    });
    expect(buildWarnings([truncated, truncated])).toEqual([
      "2 issues had more than 20 labels; only the first 20 were imported.",
      "2 issues had more than 10 linked issues; only the first 10 links were imported.",
    ]);
  });
});

describe("mapTeam", () => {
  it("builds the project from a team", () => {
    const team: LinearTeam = {
      id: "team-1",
      key: "ENG",
      name: "Engineering",
      description: "  Product engineering ",
      states: { nodes: STATES },
    };
    const project = mapTeam(
      team,
      [
        issue("a", { number: 7, state: { id: "duplicate" } }),
        issue("b", { number: 3 }),
      ],
      [
        {
          body: "Hello",
          createdAt: "2024-03-01T10:00:00.000Z",
          user: { name: "Ada", email: "ada@example.com" },
          botActor: null,
          issue: { id: "b" },
        },
      ],
    );

    expect(project.name).toBe("Engineering");
    expect(project.key).toBe("ENG");
    expect(project.description).toBe("Product engineering");
    expect(project.columns.map((column) => column.key)).toEqual([
      "todo",
      "in-progress",
      "in-review",
      "done",
      "canceled",
      "duplicate",
    ]);
    expect(project.tasks.map((task) => task.key)).toEqual(["b", "a"]);
    expect(project.tasks.map((task) => task.number)).toEqual([3, 7]);
    expect(project.tasks[0]?.comments).toHaveLength(1);
    expect(project.tasks[1]?.comments).toEqual([]);
    expect(project.labels).toEqual([]);
    expect(project.relations).toEqual([]);
  });
});
