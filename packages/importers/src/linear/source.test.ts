import { describe, expect, it } from "vite-plus/test";
import type { FetchLike } from "../types.js";
import type { LinearComment, LinearIssue } from "./client.js";
import { INVALID_API_KEY_MESSAGE } from "./graphql.js";
import { connectLinear } from "./source.js";

const API_KEY = "lin_api_secret";

type Variables = Record<string, unknown>;
type Handler = (variables: Variables) => unknown;

function fakeLinear(handlers: Record<string, Handler>) {
  const calls: Array<{
    operation: string;
    query: string;
    variables: Variables;
    headers: Headers;
  }> = [];
  const fetch: FetchLike = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Variables;
    };
    const operation = /query (\w+)/.exec(body.query)?.[1] ?? "";
    calls.push({
      operation,
      query: body.query,
      variables: body.variables,
      headers: new Headers(init?.headers),
    });
    const handler = handlers[operation];
    const payload = handler
      ? { data: handler(body.variables) }
      : { errors: [{ message: `Unexpected operation ${operation}` }] };
    return new Response(JSON.stringify(payload), {
      status: handler ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fetch, calls };
}

function page<T>(nodes: T[], endCursor: string | null) {
  return { nodes, pageInfo: { hasNextPage: endCursor !== null, endCursor } };
}

function byCursor<T>(
  field: string,
  pages: Record<string, { nodes: T[]; next: string | null }>,
) {
  return (variables: Variables) => {
    const current = pages[String(variables.after ?? "start")];
    if (!current) throw new Error(`unknown cursor ${String(variables.after)}`);
    return { [field]: page(current.nodes, current.next) };
  };
}

function issue(id: string, overrides: Partial<LinearIssue> = {}): LinearIssue {
  return {
    id,
    number: 1,
    title: `Issue ${id}`,
    description: null,
    priority: 0,
    dueDate: null,
    sortOrder: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    state: { id: "todo" },
    assignee: null,
    parent: null,
    labels: { nodes: [], pageInfo: { hasNextPage: false } },
    relations: { nodes: [], pageInfo: { hasNextPage: false } },
    ...overrides,
  };
}

const TEAM = {
  id: "team-1",
  key: "ENG",
  name: "Engineering",
  description: null,
  states: {
    nodes: [
      {
        id: "done",
        name: "Done",
        type: "completed",
        position: 3,
        color: "#5e6ad2",
      },
      {
        id: "todo",
        name: "Todo",
        type: "unstarted",
        position: 1,
        color: "#e2e2e2",
      },
      {
        id: "triage",
        name: "Triage",
        type: "triage",
        position: 0,
        color: "#fc7840",
      },
      {
        id: "doing",
        name: "In Progress",
        type: "started",
        position: 2,
        color: "#f2c94c",
      },
    ],
  },
};

const BUG = { id: "label-bug", name: "Bug", color: "#EB5757", parent: null };

const ISSUES_PAGE_1 = [
  issue("i-1", {
    number: 1,
    title: "Ship importer",
    priority: 1,
    state: { id: "doing" },
    sortOrder: 2,
    assignee: { name: "Ada Lovelace", email: "ada@example.com" },
    labels: { nodes: [BUG], pageInfo: { hasNextPage: false } },
    relations: {
      nodes: [{ type: "blocks", relatedIssue: { id: "i-3" } }],
      pageInfo: { hasNextPage: false },
    },
  }),
  issue("i-2", { number: 2, title: "Write docs", priority: 4, sortOrder: 1 }),
];

const ISSUES_PAGE_2 = [
  issue("i-3", {
    number: 3,
    title: "Release",
    parent: { id: "i-1" },
    state: { id: "done" },
    dueDate: "2024-06-30",
    relations: {
      nodes: [{ type: "related", relatedIssue: { id: "i-2" } }],
      pageInfo: { hasNextPage: false },
    },
  }),
];

const COMMENTS_PAGE_1: LinearComment[] = [
  {
    body: "Looks good",
    createdAt: "2024-02-02T00:00:00.000Z",
    user: { name: "Grace Hopper", email: "grace@example.com" },
    botActor: null,
    issue: { id: "i-1" },
  },
];

const COMMENTS_PAGE_2: LinearComment[] = [
  {
    body: "Linked PR #42",
    createdAt: "2024-02-01T00:00:00.000Z",
    user: null,
    botActor: { name: "GitHub" },
    issue: { id: "i-1" },
  },
];

function linearApi() {
  return fakeLinear({
    ImportViewer: () => ({
      viewer: { id: "user-1", name: "Ada", email: "ada@example.com" },
    }),
    ImportTeams: byCursor("teams", {
      start: {
        nodes: [
          { id: "team-1", key: "ENG", name: "Engineering", issueCount: 3 },
        ],
        next: "teams-2",
      },
      "teams-2": {
        nodes: [
          { id: "team-2", key: "OPS", name: "Operations", issueCount: 1 },
        ],
        next: null,
      },
    }),
    ImportTeam: (variables) => {
      if (variables.teamId !== "team-1") {
        throw new Error("unknown team");
      }
      return { team: TEAM };
    },
    ImportIssues: byCursor("issues", {
      start: { nodes: ISSUES_PAGE_1, next: "issues-2" },
      "issues-2": { nodes: ISSUES_PAGE_2, next: null },
    }),
    ImportComments: byCursor("comments", {
      start: { nodes: COMMENTS_PAGE_1, next: "comments-2" },
      "comments-2": { nodes: COMMENTS_PAGE_2, next: null },
    }),
  });
}

describe("connectLinear", () => {
  it("validates the API key with the viewer query", async () => {
    const api = linearApi();
    await connectLinear({ apiKey: `  ${API_KEY} ` }, { fetch: api.fetch });

    expect(api.calls.map((call) => call.operation)).toEqual(["ImportViewer"]);
    expect(api.calls[0]?.headers.get("authorization")).toBe(API_KEY);
  });

  it("asks for a key before calling Linear", async () => {
    const api = linearApi();
    await expect(
      connectLinear({ apiKey: "  " }, { fetch: api.fetch }),
    ).rejects.toThrow("Enter a Linear personal API key");
    expect(api.calls).toHaveLength(0);
  });

  it("explains an invalid API key", async () => {
    const fetch: FetchLike = async () =>
      new Response(
        JSON.stringify({
          errors: [
            {
              message: "Authentication required, not authenticated",
              extensions: { code: "AUTHENTICATION_ERROR" },
            },
          ],
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );

    await expect(connectLinear({ apiKey: API_KEY }, { fetch })).rejects.toThrow(
      INVALID_API_KEY_MESSAGE,
    );
  });

  it("lists teams across pages with their key and issue count", async () => {
    const api = linearApi();
    const source = await connectLinear(
      { apiKey: API_KEY },
      { fetch: api.fetch },
    );

    expect(await source.listProjects()).toEqual([
      { id: "team-1", name: "Engineering", detail: "ENG · 3 issues" },
      { id: "team-2", name: "Operations", detail: "OPS · 1 issue" },
    ]);
    expect(
      api.calls
        .filter((call) => call.operation === "ImportTeams")
        .map((call) => call.variables.after),
    ).toEqual([null, "teams-2"]);
  });

  it("reads a team with paginated issues and comments", async () => {
    const api = linearApi();
    const source = await connectLinear(
      { apiKey: API_KEY },
      { fetch: api.fetch },
    );
    const progress: string[] = [];

    const project = await source.readProject("team-1", {
      includeComments: true,
      onProgress: (message) => progress.push(message),
    });

    expect(project.name).toBe("Engineering");
    expect(project.key).toBe("ENG");
    expect(project.description).toBeUndefined();
    expect(project.columns).toEqual([
      { key: "todo", name: "Todo", isFinal: false },
      { key: "doing", name: "In Progress", isFinal: false },
      { key: "done", name: "Done", isFinal: true },
    ]);
    expect(project.labels).toEqual([
      { key: "label-bug", name: "Bug", color: "#eb5757" },
    ]);
    expect(project.tasks).toEqual([
      {
        key: "i-2",
        number: 2,
        columnKey: "todo",
        title: "Write docs",
        description: "",
        priority: "low",
        createdAt: "2024-01-01T00:00:00.000Z",
        labelKeys: [],
        comments: [],
      },
      {
        key: "i-1",
        number: 1,
        columnKey: "doing",
        title: "Ship importer",
        description: "",
        priority: "urgent",
        createdAt: "2024-01-01T00:00:00.000Z",
        assignee: { name: "Ada Lovelace", email: "ada@example.com" },
        labelKeys: ["label-bug"],
        comments: [
          {
            author: { name: "GitHub" },
            body: "Linked PR #42",
            createdAt: "2024-02-01T00:00:00.000Z",
          },
          {
            author: { name: "Grace Hopper", email: "grace@example.com" },
            body: "Looks good",
            createdAt: "2024-02-02T00:00:00.000Z",
          },
        ],
      },
      {
        key: "i-3",
        number: 3,
        columnKey: "done",
        title: "Release",
        description: "",
        priority: "no-priority",
        dueDate: "2024-06-30T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        labelKeys: [],
        comments: [],
      },
    ]);
    expect(project.relations).toEqual([
      { sourceKey: "i-1", targetKey: "i-3", type: "blocks" },
      { sourceKey: "i-1", targetKey: "i-3", type: "subtask" },
      { sourceKey: "i-3", targetKey: "i-2", type: "related" },
    ]);
    expect(project.warnings).toEqual([]);

    expect(
      api.calls
        .filter((call) => call.operation === "ImportIssues")
        .map((call) => call.variables),
    ).toEqual([
      { teamId: "team-1", after: null },
      { teamId: "team-1", after: "issues-2" },
    ]);
    expect(
      api.calls.find((call) => call.operation === "ImportIssues")?.query,
    ).toMatch(/^\s+number$/m);
    expect(progress).toEqual([
      "Reading team",
      "Reading issues",
      "Reading issues (2 so far)",
      "Reading issues (3 so far)",
      "Reading comments",
      "Reading comments (1 so far)",
      "Reading comments (2 so far)",
    ]);
    expect(
      api.calls.every((call) => call.headers.get("authorization") === API_KEY),
    ).toBe(true);
  });

  it("skips comments when they are not requested", async () => {
    const api = linearApi();
    const source = await connectLinear(
      { apiKey: API_KEY },
      { fetch: api.fetch },
    );

    const project = await source.readProject("team-1", {
      includeComments: false,
    });

    expect(project.tasks.every((task) => task.comments.length === 0)).toBe(
      true,
    );
    expect(api.calls.some((call) => call.operation === "ImportComments")).toBe(
      false,
    );
  });

  it("explains a missing team", async () => {
    const api = fakeLinear({
      ImportViewer: () => ({
        viewer: { id: "user-1", name: null, email: null },
      }),
    });
    const notFound: FetchLike = async (url, init) => {
      const body = String(init?.body);
      if (body.includes("ImportTeam(")) {
        return new Response(
          JSON.stringify({
            errors: [
              {
                message: "Entity not found: Team",
                extensions: { code: "INVALID_INPUT" },
              },
            ],
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      return api.fetch(url, init);
    };
    const source = await connectLinear(
      { apiKey: API_KEY },
      { fetch: notFound },
    );

    await expect(
      source.readProject("missing", { includeComments: false }),
    ).rejects.toThrow("This Linear team was not found.");
  });
});
