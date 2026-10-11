import { describe, expect, it } from "vite-plus/test";
import type { FetchLike } from "../types.js";
import {
  CLOUD_REJECTED_MESSAGE,
  MISSING_EMAIL_MESSAGE,
  SERVER_REJECTED_MESSAGE,
} from "./auth.js";
import { connectJira } from "./index.js";
import { NOT_JIRA_MESSAGE } from "./source.js";
import { BOARD_UNAVAILABLE_WARNING } from "./warnings.js";

const TOKEN = "jira-secret-token";
const CLOUD_URL =
  "https://acme.atlassian.net/jira/software/projects/ABC/boards/7";
const SERVER_URL = "https://example.com/jira/secure/Dashboard.jspa";

type Request = {
  method: string;
  url: URL;
  headers: Headers;
  body: Record<string, unknown> | null;
};
type Handler = (request: Request) => unknown;

class Reply {
  constructor(
    readonly status: number,
    readonly body: unknown = { errorMessages: ["Nope"], errors: {} },
  ) {}
}

function fakeJira(routes: Record<string, Handler | unknown>) {
  const calls: Request[] = [];
  const fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    const request: Request = {
      method,
      url,
      headers: new Headers(init?.headers),
      body: init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : null,
    };
    calls.push(request);
    const route = routes[`${method} ${url.pathname}`];
    const value =
      typeof route === "function" ? (route as Handler)(request) : route;
    if (value === undefined) {
      return json(404, { errorMessages: ["Not found"], errors: {} });
    }
    if (value instanceof Reply) return json(value.status, value.body);
    return json(200, value);
  };
  const paths = (method?: string) =>
    calls
      .filter((call) => !method || call.method === method)
      .map((call) => `${call.method} ${call.url.pathname}`);
  return { fetch, calls, paths };
}

function json(status: number, body: unknown) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const STATUSES = {
  backlog: { id: "1", name: "Backlog", statusCategory: { key: "new" } },
  todo: {
    id: "2",
    name: "Selected for Development",
    statusCategory: { key: "new" },
  },
  doing: {
    id: "3",
    name: "In Progress",
    statusCategory: { key: "indeterminate" },
  },
  done: { id: "4", name: "Done", statusCategory: { key: "done" } },
};

const STATUS_GROUPS = [
  {
    id: "10001",
    name: "Task",
    subtask: false,
    statuses: [STATUSES.backlog, STATUSES.todo, STATUSES.doing, STATUSES.done],
  },
  {
    id: "10002",
    name: "Sub-task",
    subtask: true,
    statuses: [STATUSES.todo, STATUSES.done],
  },
];

const BOARD_CONFIG = {
  id: 7,
  name: "ABC board",
  type: "kanban",
  columnConfig: {
    columns: [
      { name: "Backlog", statuses: [{ id: "1" }] },
      { name: "Selected for Development", statuses: [{ id: "2" }] },
      { name: "In Progress", statuses: [{ id: "3" }] },
      { name: "Done", statuses: [{ id: "4" }] },
    ],
  },
};

function issue(
  id: string,
  number: number,
  fields: Record<string, unknown>,
  description = "",
) {
  return {
    id,
    key: `ABC-${number}`,
    fields: {
      summary: `Issue ${number}`,
      status: STATUSES.todo,
      priority: { name: "Medium" },
      labels: [],
      issuelinks: [],
      attachment: [],
      created: "2024-01-01T10:00:00.000+0000",
      ...fields,
    },
    renderedFields: { description },
  };
}

const ISSUE_PAGE_1 = [
  issue(
    "101",
    1,
    {
      status: STATUSES.doing,
      priority: { name: "Highest" },
      assignee: {
        accountId: "a1",
        displayName: "Ada Lovelace",
        emailAddress: "ada@example.com",
      },
      labels: ["frontend"],
      duedate: "2024-06-30",
      issuelinks: [
        {
          type: { name: "Blocks", inward: "is blocked by", outward: "blocks" },
          outwardIssue: { id: "103", key: "ABC-3" },
        },
      ],
      comment: { comments: [], total: 2 },
    },
    '<p>Ship it, cc <a href="/secure/ViewProfile.jspa?accountId=a2" class="user-hover" data-account-id="a2">Grace Hopper</a></p>',
  ),
  issue("102", 2, {
    status: STATUSES.backlog,
    priority: { name: "Low" },
    attachment: [{ id: "a" }],
    comment: { comments: [], total: 0 },
  }),
];

const ISSUE_PAGE_2 = [
  issue("103", 3, {
    status: STATUSES.done,
    parent: { id: "101", key: "ABC-1" },
    issuelinks: [
      {
        type: { name: "Blocks", inward: "is blocked by", outward: "blocks" },
        inwardIssue: { id: "101", key: "ABC-1" },
      },
      {
        type: { name: "Relates", inward: "relates to", outward: "relates to" },
        outwardIssue: { id: "900", key: "OPS-9" },
      },
    ],
    comment: { comments: [], total: 0 },
  }),
];

function cloudRoutes(extra: Record<string, Handler | unknown> = {}) {
  return {
    "GET /rest/api/3/myself": { accountId: "a1", displayName: "Ada Lovelace" },
    "GET /rest/api/3/project/search": (request: Request) =>
      request.url.searchParams.get("startAt") === "0"
        ? {
            values: [
              {
                id: "100",
                key: "ABC",
                name: "Alpha",
                projectTypeKey: "software",
              },
            ],
            isLast: false,
          }
        : {
            values: [
              {
                id: "200",
                key: "OPS",
                name: "Operations",
                projectTypeKey: "business",
              },
            ],
            isLast: true,
          },
    "GET /rest/api/3/project/ABC": {
      id: "100",
      key: "ABC",
      name: "Alpha",
      description: "Core product",
    },
    "GET /rest/api/3/project/ABC/statuses": STATUS_GROUPS,
    "GET /rest/agile/1.0/board": {
      values: [
        { id: 3, type: "scrum", location: { projectKey: "OPS" } },
        { id: 7, type: "kanban", location: { projectKey: "ABC" } },
      ],
    },
    "GET /rest/agile/1.0/board/7/configuration": BOARD_CONFIG,
    "POST /rest/api/3/search/jql": (request: Request) =>
      request.body?.nextPageToken === "page-2"
        ? { issues: ISSUE_PAGE_2, isLast: true }
        : { issues: ISSUE_PAGE_1, nextPageToken: "page-2", isLast: false },
    "GET /rest/api/3/issue/101/comment": (request: Request) =>
      request.url.searchParams.get("startAt") === "0"
        ? {
            startAt: 0,
            maxResults: 1,
            total: 2,
            comments: [
              {
                id: "c2",
                author: { displayName: "Grace Hopper" },
                renderedBody: "<p>Second</p>",
                created: "2024-02-02T10:00:00.000+0000",
              },
            ],
          }
        : {
            startAt: 1,
            maxResults: 1,
            total: 2,
            comments: [
              {
                id: "c1",
                author: {
                  displayName: "Ada Lovelace",
                  emailAddress: "ada@example.com",
                },
                renderedBody: "<p>First <b>note</b></p>",
                created: "2024-02-01T10:00:00.000+0000",
              },
            ],
          },
    ...extra,
  };
}

function serverIssues() {
  return [
    issue("201", 1, { status: STATUSES.todo, comment: { total: 0 } }),
    issue("202", 2, { status: STATUSES.done, comment: { total: 0 } }),
    issue("203", 3, { status: STATUSES.doing, comment: { total: 0 } }),
  ];
}

function serverRoutes(extra: Record<string, Handler | unknown> = {}) {
  return {
    "GET /jira/rest/api/2/myself": {
      key: "JIRAUSER1",
      name: "fred",
      displayName: "Fred",
    },
    "GET /jira/rest/api/2/project": [
      { id: "1", key: "ABC", name: "Alpha", projectTypeKey: "software" },
      { id: "2", key: "LEG", name: "Legacy" },
    ],
    "GET /jira/rest/api/2/project/ABC": { id: "1", key: "ABC", name: "Alpha" },
    "GET /jira/rest/api/2/project/ABC/statuses": STATUS_GROUPS,
    "GET /jira/rest/api/2/search": (request: Request) => {
      const startAt = Number(request.url.searchParams.get("startAt"));
      const issues = serverIssues();
      return {
        startAt,
        maxResults: 2,
        total: issues.length,
        issues: issues.slice(startAt, startAt + 2),
      };
    },
    ...extra,
  };
}

describe("connectJira", () => {
  it("signs in to Jira Cloud with Basic auth and REST API v3", async () => {
    const jira = fakeJira(cloudRoutes());
    await connectJira(
      { url: CLOUD_URL, email: " ada@example.com ", apiToken: ` ${TOKEN} ` },
      { fetch: jira.fetch },
    );

    expect(jira.paths()).toEqual(["GET /rest/api/3/myself"]);
    const call = jira.calls[0];
    expect(call?.url.origin).toBe("https://acme.atlassian.net");
    expect(call?.headers.get("authorization")).toBe(
      `Basic ${Buffer.from(`ada@example.com:${TOKEN}`).toString("base64")}`,
    );
    expect(call?.url.href).not.toContain(TOKEN);
  });

  it("uses a bearer token and REST API v2 on Data Center", async () => {
    const jira = fakeJira(serverRoutes());
    await connectJira(
      { url: SERVER_URL, apiToken: TOKEN },
      { fetch: jira.fetch },
    );

    expect(jira.calls[0]?.url.href).toBe(
      "https://example.com/jira/rest/api/2/myself",
    );
    expect(jira.calls[0]?.headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("uses Basic auth on Data Center when an email is given", async () => {
    const jira = fakeJira(serverRoutes());
    await connectJira(
      { url: SERVER_URL, email: "fred@example.com", apiToken: TOKEN },
      { fetch: jira.fetch },
    );
    expect(jira.calls[0]?.headers.get("authorization")).toBe(
      `Basic ${Buffer.from(`fred@example.com:${TOKEN}`).toString("base64")}`,
    );
  });

  it("asks for the account email on Jira Cloud before calling Jira", async () => {
    const jira = fakeJira(cloudRoutes());
    await expect(
      connectJira({ url: CLOUD_URL, apiToken: TOKEN }, { fetch: jira.fetch }),
    ).rejects.toThrow(MISSING_EMAIL_MESSAGE);
    expect(jira.calls).toHaveLength(0);
  });

  it.each([
    [
      CLOUD_URL,
      "ada@example.com",
      "GET /rest/api/3/myself",
      CLOUD_REJECTED_MESSAGE,
    ],
    [
      SERVER_URL,
      undefined,
      "GET /jira/rest/api/2/myself",
      SERVER_REJECTED_MESSAGE,
    ],
  ])(
    "explains rejected credentials for %s",
    async (url, email, route, message) => {
      const jira = fakeJira({ [route]: new Reply(401, { message: TOKEN }) });
      const error = await connectJira(
        { url, ...(email ? { email } : {}), apiToken: TOKEN },
        { fetch: jira.fetch },
      ).catch((caught: unknown) => caught as Error);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(message);
      expect((error as Error).message).not.toContain(TOKEN);
    },
  );

  it("rejects addresses that are not Jira", async () => {
    const missing = fakeJira({});
    await expect(
      connectJira(
        { url: "https://example.org", apiToken: TOKEN },
        { fetch: missing.fetch },
      ),
    ).rejects.toThrow(NOT_JIRA_MESSAGE);

    const html = fakeJira({ "GET /rest/api/2/myself": "<html>Sign in</html>" });
    await expect(
      connectJira(
        { url: "https://example.org", apiToken: TOKEN },
        { fetch: html.fetch },
      ),
    ).rejects.toThrow(NOT_JIRA_MESSAGE);
  });
});

describe("listProjects", () => {
  it("pages through Jira Cloud projects", async () => {
    const jira = fakeJira(cloudRoutes());
    const source = await connectJira(
      { url: CLOUD_URL, email: "ada@example.com", apiToken: TOKEN },
      { fetch: jira.fetch },
    );

    expect(await source.listProjects()).toEqual([
      { id: "ABC", name: "Alpha", detail: "ABC · Software" },
      { id: "OPS", name: "Operations", detail: "OPS · Business" },
    ]);
    const pages = jira.calls.filter((call) =>
      call.url.pathname.endsWith("/project/search"),
    );
    expect(pages.map((call) => call.url.searchParams.get("startAt"))).toEqual([
      "0",
      "1",
    ]);
    expect(pages[0]?.url.searchParams.get("maxResults")).toBe("50");
  });

  it("reads the full project list on Data Center", async () => {
    const jira = fakeJira(serverRoutes());
    const source = await connectJira(
      { url: SERVER_URL, apiToken: TOKEN },
      { fetch: jira.fetch },
    );
    expect(await source.listProjects()).toEqual([
      { id: "ABC", name: "Alpha", detail: "ABC · Software" },
      { id: "LEG", name: "Legacy", detail: "LEG" },
    ]);
  });
});

describe("readProject on Jira Cloud", () => {
  it("reads the board, pages issues by token, reads comments and maps the project", async () => {
    const jira = fakeJira(cloudRoutes());
    const source = await connectJira(
      { url: CLOUD_URL, email: "ada@example.com", apiToken: TOKEN },
      { fetch: jira.fetch },
    );
    const progress: string[] = [];
    const project = await source.readProject("ABC", {
      includeComments: true,
      onProgress: (message) => progress.push(message),
    });

    const searches = jira.calls.filter((call) =>
      call.url.pathname.endsWith("/search/jql"),
    );
    expect(searches.map((call) => call.body?.nextPageToken)).toEqual([
      undefined,
      "page-2",
    ]);
    expect(searches[0]?.body).toMatchObject({
      jql: 'project = "ABC" ORDER BY Rank ASC',
      maxResults: 100,
      expand: "renderedFields",
    });
    expect(searches[0]?.body?.fields).toEqual(
      expect.arrayContaining([
        "summary",
        "description",
        "status",
        "parent",
        "issuelinks",
        "attachment",
        "comment",
      ]),
    );
    expect(
      jira.calls
        .find((call) => call.url.pathname === "/rest/agile/1.0/board")
        ?.url.searchParams.get("projectKeyOrId"),
    ).toBe("ABC");
    const commentCalls = jira.calls.filter((call) =>
      call.url.pathname.endsWith("/comment"),
    );
    expect(
      commentCalls.map((call) => [
        call.url.pathname,
        call.url.searchParams.get("startAt"),
      ]),
    ).toEqual([
      ["/rest/api/3/issue/101/comment", "0"],
      ["/rest/api/3/issue/101/comment", "1"],
    ]);
    expect(commentCalls[0]?.url.searchParams.get("expand")).toBe(
      "renderedBody",
    );
    expect(commentCalls[0]?.url.searchParams.get("maxResults")).toBe("100");

    expect(progress).toEqual([
      "Reading project and board",
      "Reading issues",
      "Reading issues (2 so far)",
      "Reading issues (3 so far)",
      "Reading comments (1 of 1)",
    ]);

    expect(project.name).toBe("Alpha");
    expect(project.key).toBe("ABC");
    expect(project.description).toBe("Core product");
    expect(project.columns).toEqual([
      { key: "column-2", name: "Selected for Development", isFinal: false },
      { key: "column-3", name: "In Progress", isFinal: false },
      { key: "column-4", name: "Done", isFinal: true },
    ]);
    expect(project.labels).toEqual([
      {
        key: "frontend",
        name: "frontend",
        color: expect.stringMatching(/^#[0-9a-f]{6}$/),
      },
    ]);
    expect(project.tasks).toEqual([
      {
        key: "102",
        number: 2,
        columnKey: null,
        title: "Issue 2",
        description: "",
        priority: "low",
        createdAt: "2024-01-01T10:00:00.000Z",
        labelKeys: [],
        comments: [],
      },
      {
        key: "101",
        number: 1,
        columnKey: "column-3",
        title: "Issue 1",
        description: "Ship it, cc @Grace Hopper",
        priority: "urgent",
        dueDate: "2024-06-30T00:00:00.000Z",
        createdAt: "2024-01-01T10:00:00.000Z",
        assignee: { name: "Ada Lovelace", email: "ada@example.com" },
        labelKeys: ["frontend"],
        comments: [
          {
            author: { name: "Ada Lovelace", email: "ada@example.com" },
            body: "First **note**",
            createdAt: "2024-02-01T10:00:00.000Z",
          },
          {
            author: { name: "Grace Hopper" },
            body: "Second",
            createdAt: "2024-02-02T10:00:00.000Z",
          },
        ],
      },
      {
        key: "103",
        number: 3,
        columnKey: "column-4",
        title: "Issue 3",
        description: "",
        priority: "medium",
        createdAt: "2024-01-01T10:00:00.000Z",
        labelKeys: [],
        comments: [],
      },
    ]);
    expect(project.relations).toEqual([
      { sourceKey: "101", targetKey: "103", type: "blocks" },
      { sourceKey: "101", targetKey: "103", type: "subtask" },
    ]);
    expect(project.warnings).toEqual([
      "1 issue has attachments, which are not imported.",
      "1 parent or issue link points to another project, so it was not imported.",
    ]);
  });

  it("leaves comments out of the search and skips the comment requests when not asked", async () => {
    const jira = fakeJira(cloudRoutes());
    const source = await connectJira(
      { url: CLOUD_URL, email: "ada@example.com", apiToken: TOKEN },
      { fetch: jira.fetch },
    );
    const project = await source.readProject("ABC", { includeComments: false });

    const search = jira.calls.find((call) =>
      call.url.pathname.endsWith("/search/jql"),
    );
    expect(search?.body?.fields).not.toContain("comment");
    expect(jira.paths().some((path) => path.endsWith("/comment"))).toBe(false);
    expect(project.tasks.every((task) => task.comments.length === 0)).toBe(
      true,
    );
  });

  it.each([401, 403, 404])(
    "falls back to statuses when the board configuration answers %i",
    async (status) => {
      const jira = fakeJira(
        cloudRoutes({
          "GET /rest/agile/1.0/board/7/configuration": new Reply(status),
        }),
      );
      const source = await connectJira(
        { url: CLOUD_URL, email: "ada@example.com", apiToken: TOKEN },
        { fetch: jira.fetch },
      );
      const project = await source.readProject("ABC", {
        includeComments: false,
      });

      expect(project.columns).toEqual([
        { key: "2", name: "Selected for Development", isFinal: false },
        { key: "3", name: "In Progress", isFinal: false },
        { key: "4", name: "Done", isFinal: true },
      ]);
      expect(project.tasks.map((task) => [task.key, task.columnKey])).toEqual([
        ["102", null],
        ["101", "3"],
        ["103", "4"],
      ]);
      expect(project.warnings).toContain(BOARD_UNAVAILABLE_WARNING);
    },
  );

  it("uses statuses without a warning when the project has no board", async () => {
    const jira = fakeJira(
      cloudRoutes({ "GET /rest/agile/1.0/board": { values: [] } }),
    );
    const source = await connectJira(
      { url: CLOUD_URL, email: "ada@example.com", apiToken: TOKEN },
      { fetch: jira.fetch },
    );
    const project = await source.readProject("ABC", { includeComments: false });

    expect(project.columns.map((column) => column.key)).toEqual([
      "2",
      "3",
      "4",
    ]);
    expect(project.warnings).not.toContain(BOARD_UNAVAILABLE_WARNING);
    expect(jira.paths().some((path) => path.endsWith("/configuration"))).toBe(
      false,
    );
  });

  it("explains a project that does not exist", async () => {
    const jira = fakeJira(cloudRoutes());
    const source = await connectJira(
      { url: CLOUD_URL, email: "ada@example.com", apiToken: TOKEN },
      { fetch: jira.fetch },
    );
    await expect(
      source.readProject("NOPE", { includeComments: false }),
    ).rejects.toThrow(
      'Jira could not find the project "NOPE", or this account cannot browse it.',
    );
  });
});

describe("readProject on Data Center", () => {
  it("pages issues by offset and uses statuses when Jira Software is missing", async () => {
    const jira = fakeJira(serverRoutes());
    const source = await connectJira(
      { url: SERVER_URL, apiToken: TOKEN },
      { fetch: jira.fetch },
    );
    const progress: string[] = [];
    const project = await source.readProject("ABC", {
      includeComments: true,
      onProgress: (message) => progress.push(message),
    });

    const searches = jira.calls.filter((call) =>
      call.url.pathname.endsWith("/rest/api/2/search"),
    );
    expect(
      searches.map((call) => call.url.searchParams.get("startAt")),
    ).toEqual(["0", "2"]);
    expect(searches[0]?.url.searchParams.get("jql")).toBe(
      'project = "ABC" ORDER BY Rank ASC',
    );
    expect(searches[0]?.url.searchParams.get("expand")).toBe("renderedFields");
    expect(searches[0]?.url.searchParams.get("fields")?.split(",")).toContain(
      "comment",
    );
    expect(jira.paths().some((path) => path.endsWith("/comment"))).toBe(false);
    expect(progress).toContain("Reading issues (3 so far)");

    expect(project.columns.map((column) => column.key)).toEqual([
      "2",
      "3",
      "4",
    ]);
    expect(project.tasks.map((task) => [task.key, task.columnKey])).toEqual([
      ["201", "2"],
      ["203", "3"],
      ["202", "4"],
    ]);
    expect(project.warnings).toEqual([]);
  });

  it("orders by creation when the Rank field does not exist", async () => {
    const jira = fakeJira(
      serverRoutes({
        "GET /jira/rest/api/2/search": (request: Request) => {
          const jql = request.url.searchParams.get("jql") ?? "";
          if (jql.includes("Rank")) {
            return new Reply(400, {
              errorMessages: [
                "Field 'Rank' does not exist or you do not have permission to view it.",
              ],
              errors: {},
            });
          }
          return {
            startAt: 0,
            maxResults: 100,
            total: 1,
            issues: serverIssues().slice(0, 1),
          };
        },
      }),
    );
    const source = await connectJira(
      { url: SERVER_URL, apiToken: TOKEN },
      { fetch: jira.fetch },
    );
    const project = await source.readProject("ABC", { includeComments: false });

    expect(
      jira.calls
        .filter((call) => call.url.pathname.endsWith("/search"))
        .map((call) => call.url.searchParams.get("jql")),
    ).toEqual([
      'project = "ABC" ORDER BY Rank ASC',
      'project = "ABC" ORDER BY created ASC',
    ]);
    expect(project.tasks.map((task) => task.key)).toEqual(["201"]);
  });

  it("surfaces other search errors with the Jira message", async () => {
    const jira = fakeJira(
      serverRoutes({
        "GET /jira/rest/api/2/search": new Reply(400, {
          errorMessages: [
            "The value 'ABC' does not exist for the field 'project'.",
          ],
          errors: {},
        }),
      }),
    );
    const source = await connectJira(
      { url: SERVER_URL, apiToken: TOKEN },
      { fetch: jira.fetch },
    );
    await expect(
      source.readProject("ABC", { includeComments: false }),
    ).rejects.toThrow(
      "Jira: The value 'ABC' does not exist for the field 'project'.",
    );
    expect(
      jira.paths().filter((path) => path.endsWith("/search")),
    ).toHaveLength(2);
  });
});
