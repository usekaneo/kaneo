import { describe, expect, it } from "vite-plus/test";
import type { FetchLike } from "../types.js";
import { connectPlane } from "./index.js";
import { REJECTED_KEY_MESSAGE } from "./source.js";

type Route = (url: URL) => unknown;
type Call = { url: URL; headers: Headers };

const WS = "/api/v1/workspaces/acme";
const PROJECT = `${WS}/projects/p1`;
const API_KEY = "plane_api_secret";

class Status {
  constructor(
    readonly status: number,
    readonly body: unknown = { detail: "nope" },
    readonly headers: Record<string, string> = {},
  ) {}
}

function fakePlane(routes: Record<string, Route | unknown>) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, headers: new Headers(init?.headers) });
    const route = routes[url.pathname];
    const value = typeof route === "function" ? (route as Route)(url) : route;
    if (value === undefined) return json(404, { detail: "Not found." });
    if (value instanceof Status) {
      return typeof value.body === "string"
        ? new Response(value.body, {
            status: value.status,
            headers: value.headers,
          })
        : json(value.status, value.body, value.headers);
    }
    return json(200, value);
  };
  return { fetch, calls, paths: () => calls.map((call) => call.url.pathname) };
}

function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function page<T>(results: T[], next: string | null = null) {
  return {
    results,
    next_cursor: next ?? "100:1:0",
    next_page_results: next !== null,
    total_results: undefined as number | undefined,
  };
}

const me = { id: "u-me", email: "me@example.com", display_name: "me" };

const projects = [
  {
    id: "p1",
    name: "Website",
    identifier: "WEB",
    description: "Marketing site",
    archived_at: null,
  },
  {
    id: "p2",
    name: "Old",
    identifier: "OLD",
    archived_at: "2025-01-01T00:00:00Z",
  },
];

const states = [
  {
    id: "s-done",
    name: "Done",
    group: "completed",
    sequence: 3,
    color: "#00ff00",
  },
  {
    id: "s-todo",
    name: "Todo",
    group: "unstarted",
    sequence: 1,
    color: "#cccccc",
  },
  {
    id: "s-doing",
    name: "Doing",
    group: "started",
    sequence: 2,
    color: "#0000ff",
  },
];

const labels = [
  { id: "l-bug", name: "Bug", color: "#E11D48", parent: null },
  { id: "l-idle", name: "Idle", color: "#000000", parent: null },
];

const members = [
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
    first_name: "Bob",
    last_name: "Ray",
  },
];

function workItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Item ${id}`,
    description_html: "<p></p>",
    priority: "none",
    state: "s-todo",
    assignees: [],
    labels: [],
    parent: null,
    sort_order: 1000,
    sequence_id: 1,
    created_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

function baseRoutes(extra: Record<string, Route | unknown> = {}) {
  return {
    "/api/v1/users/me/": me,
    [`${WS}/projects/`]: page(projects),
    [`${PROJECT}/states/`]: page(states),
    [`${PROJECT}/labels/`]: labels,
    [`${PROJECT}/members/`]: members,
    ...extra,
  };
}

describe("connectPlane", () => {
  it("authenticates with the X-API-Key header against api.plane.so", async () => {
    const plane = fakePlane(baseRoutes());
    await connectPlane(
      {
        url: "https://app.plane.so/acme/projects/p1/issues",
        apiKey: ` ${API_KEY} `,
      },
      { fetch: plane.fetch },
    );

    expect(plane.paths()).toEqual(["/api/v1/users/me/", `${WS}/projects/`]);
    for (const call of plane.calls) {
      expect(call.url.origin).toBe("https://api.plane.so");
      expect(call.headers.get("x-api-key")).toBe(API_KEY);
      expect(call.headers.get("authorization")).toBeNull();
      expect(call.url.href).not.toContain(API_KEY);
    }
    expect(plane.calls[1]?.url.searchParams.get("per_page")).toBe("100");
  });

  it("talks to a self-hosted origin directly", async () => {
    const plane = fakePlane(baseRoutes());
    await connectPlane(
      { url: "plane.example.com/acme/", apiKey: API_KEY },
      { fetch: plane.fetch },
    );
    expect(plane.calls[0]?.url.origin).toBe("https://plane.example.com");
  });

  it.each([401, 403])(
    "explains a rejected API key (HTTP %i)",
    async (status) => {
      const plane = fakePlane(
        baseRoutes({ "/api/v1/users/me/": new Status(status) }),
      );
      const error = await connectPlane(
        { url: "https://app.plane.so/acme", apiKey: API_KEY },
        { fetch: plane.fetch },
      ).catch((caught: unknown) => caught as Error);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(REJECTED_KEY_MESSAGE);
      expect((error as Error).message).not.toContain(API_KEY);
    },
  );

  it.each([403, 404])(
    "reports an unknown workspace (HTTP %i)",
    async (status) => {
      const plane = fakePlane(
        baseRoutes({ [`${WS}/projects/`]: new Status(status) }),
      );
      await expect(
        connectPlane(
          { url: "https://app.plane.so/acme", apiKey: API_KEY },
          { fetch: plane.fetch },
        ),
      ).rejects.toThrow(
        'Plane could not find the workspace "acme" for this token.',
      );
    },
  );

  it("rejects servers that are not Plane", async () => {
    const plane = fakePlane(
      baseRoutes({
        "/api/v1/users/me/": new Status(200, "<html>hello</html>", {
          "Content-Type": "text/html",
        }),
      }),
    );
    await expect(
      connectPlane(
        { url: "https://example.com/acme", apiKey: API_KEY },
        { fetch: plane.fetch },
      ),
    ).rejects.toThrow(
      "This address does not look like a Plane server. Check the workspace URL.",
    );
  });

  it("requires a workspace slug and an API key before calling Plane", async () => {
    const plane = fakePlane(baseRoutes());
    await expect(
      connectPlane(
        { url: "https://app.plane.so", apiKey: API_KEY },
        { fetch: plane.fetch },
      ),
    ).rejects.toThrow(
      "Add your Plane workspace URL, for example https://app.plane.so/your-workspace",
    );
    await expect(
      connectPlane(
        { url: "https://app.plane.so/acme", apiKey: " " },
        { fetch: plane.fetch },
      ),
    ).rejects.toThrow("personal access token");
    expect(plane.calls).toHaveLength(0);
  });
});

describe("listProjects", () => {
  it("reuses the connect request, skips archived projects and shows the identifier", async () => {
    const plane = fakePlane(baseRoutes());
    const source = await connectPlane(
      { url: "https://app.plane.so/acme", apiKey: API_KEY },
      { fetch: plane.fetch },
    );

    expect(await source.listProjects()).toEqual([
      { id: "p1", name: "Website", detail: "WEB" },
    ]);
    expect(plane.calls).toHaveLength(2);

    await source.listProjects();
    expect(plane.calls).toHaveLength(3);
  });

  it("accepts the bare project list from older Plane versions", async () => {
    const plane = fakePlane(baseRoutes({ [`${WS}/projects/`]: projects }));
    const source = await connectPlane(
      { url: "https://plane.example.com/acme", apiKey: API_KEY },
      { fetch: plane.fetch },
    );
    expect((await source.listProjects()).map((project) => project.id)).toEqual([
      "p1",
    ]);
  });
});

describe("readProject", () => {
  it("reads every page of work items and maps the project", async () => {
    const plane = fakePlane(
      baseRoutes({
        [`${PROJECT}/work-items/`]: (url: URL) => {
          const cursor = url.searchParams.get("cursor");
          if (!cursor) {
            return {
              ...page(
                [
                  workItem("w-done", {
                    state: "s-done",
                    priority: "urgent",
                    sort_order: 5,
                    sequence_id: 3,
                  }),
                  workItem("w-parent", {
                    priority: "medium",
                    sort_order: 2,
                    sequence_id: 1,
                    assignees: ["u-jane", "u-bob"],
                    labels: ["l-bug"],
                    description_html:
                      '<p>Spec</p><ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>outline</p></div></li></ul>',
                    target_date: "2026-04-01",
                  }),
                ],
                "100:1:0",
              ),
              total_results: 3,
            };
          }
          expect(cursor).toBe("100:1:0");
          return {
            ...page([
              workItem("w-child", {
                state: "s-doing",
                parent: "w-parent",
                assignees: ["u-bob"],
                sequence_id: 2,
              }),
            ]),
            total_results: 3,
          };
        },
      }),
    );
    const source = await connectPlane(
      { url: "https://app.plane.so/acme", apiKey: API_KEY },
      { fetch: plane.fetch },
    );
    const progress: string[] = [];
    const result = await source.readProject("p1", {
      includeComments: false,
      onProgress: (message) => progress.push(message),
    });

    const itemCalls = plane.calls.filter((call) =>
      call.url.pathname.endsWith("/work-items/"),
    );
    expect(itemCalls).toHaveLength(2);
    const fields =
      itemCalls[0]?.url.searchParams.get("fields")?.split(",") ?? [];
    expect(fields).toEqual(
      expect.arrayContaining([
        "description_html",
        "assignees",
        "labels",
        "parent",
        "state",
        "sequence_id",
      ]),
    );
    expect(fields).not.toContain("description_binary");
    expect(itemCalls[0]?.url.searchParams.get("per_page")).toBe("100");
    expect(itemCalls[0]?.url.searchParams.get("expand")).toBeNull();
    expect(plane.paths()).not.toContain(`${PROJECT}/`);

    expect(progress).toEqual([
      "Reading states, labels and members",
      "Reading work items (2 of 3)",
      "Reading work items (3 of 3)",
    ]);

    expect(result.name).toBe("Website");
    expect(result.key).toBe("WEB");
    expect(result.description).toBe("Marketing site");
    expect(
      result.columns.map((column) => [column.key, column.isFinal]),
    ).toEqual([
      ["s-todo", false],
      ["s-doing", false],
      ["s-done", true],
    ]);
    expect(
      result.tasks.map((task) => [task.key, task.columnKey, task.priority]),
    ).toEqual([
      ["w-parent", "s-todo", "medium"],
      ["w-child", "s-doing", "no-priority"],
      ["w-done", "s-done", "urgent"],
    ]);
    expect(result.tasks.map((task) => task.number)).toEqual([1, 2, 3]);
    expect(result.tasks[0]).toMatchObject({
      title: "Item w-parent",
      description: "Spec\n\n- [x] outline",
      dueDate: "2026-04-01T00:00:00.000Z",
      assignee: { name: "Jane Doe", email: "jane@example.com" },
      labelKeys: ["l-bug"],
      comments: [],
    });
    expect(result.labels).toEqual([
      { key: "l-bug", name: "Bug", color: "#e11d48" },
    ]);
    expect(result.relations).toEqual([
      { sourceKey: "w-parent", targetKey: "w-child", type: "subtask" },
    ]);
    expect(result.warnings).toEqual([
      "1 work item has more than one assignee. Kaneo keeps one assignee per task, so only the first was assigned.",
    ]);
  });

  it("falls back to /issues/ on older self-hosted builds and reads comments", async () => {
    const plane = fakePlane(
      baseRoutes({
        [`${PROJECT}/issues/`]: page([
          workItem("w1"),
          workItem("w2", { sort_order: 2000 }),
          workItem("w3", { sort_order: 3000 }),
        ]),
        [`${PROJECT}/issues/w1/comments/`]: (url: URL) =>
          url.searchParams.get("cursor")
            ? page([
                {
                  id: "c2",
                  comment_html: "<p>Later</p>",
                  created_at: "2026-02-02T00:00:00Z",
                  actor: {
                    id: "u-jane",
                    display_name: "jane",
                    first_name: "Jane",
                    last_name: "Doe",
                  },
                },
              ])
            : page(
                [
                  {
                    id: "c1",
                    comment_html: "<p>Looks <em>good</em></p>",
                    created_at: "2026-02-01T00:00:00Z",
                    actor: {
                      id: "u-bob",
                      display_name: "bob",
                      first_name: "Bob",
                      last_name: "Ray",
                    },
                  },
                ],
                "100:1:0",
              ),
        [`${PROJECT}/issues/w2/comments/`]: [],
      }),
    );
    const source = await connectPlane(
      { url: "https://plane.example.com/acme", apiKey: API_KEY },
      { fetch: plane.fetch },
    );
    const progress: string[] = [];
    const result = await source.readProject("p1", {
      includeComments: true,
      onProgress: (message) => progress.push(message),
    });

    expect(
      plane.paths().filter((path) => path.includes("/work-items/")),
    ).toEqual([`${PROJECT}/work-items/`]);
    const commentCalls = plane.calls.filter((call) =>
      call.url.pathname.endsWith("/comments/"),
    );
    expect(commentCalls.map((call) => call.url.pathname)).toEqual([
      `${PROJECT}/issues/w1/comments/`,
      `${PROJECT}/issues/w1/comments/`,
      `${PROJECT}/issues/w2/comments/`,
      `${PROJECT}/issues/w3/comments/`,
    ]);
    expect(commentCalls[0]?.url.searchParams.get("expand")).toBe("actor");
    expect(progress).toContain("Reading comments (3 of 3)");

    expect(result.tasks.map((task) => task.key)).toEqual(["w1", "w2", "w3"]);
    expect(result.tasks[0]?.comments).toEqual([
      {
        author: { name: "Bob Ray", email: "bob@example.com" },
        body: "Looks _good_",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
      {
        author: { name: "Jane Doe", email: "jane@example.com" },
        body: "Later",
        createdAt: "2026-02-02T00:00:00.000Z",
      },
    ]);
    expect(result.tasks[1]?.comments).toEqual([]);
    expect(result.tasks[2]?.comments).toEqual([]);
  });

  it("continues without the member list and expands assignees instead", async () => {
    const plane = fakePlane(
      baseRoutes({
        [`${PROJECT}/members/`]: new Status(403, {
          detail: "You do not have permission",
        }),
        [`${PROJECT}/work-items/`]: page([
          workItem("w1", {
            assignees: [
              {
                id: "u-jane",
                display_name: "jane",
                first_name: "Jane",
                last_name: "Doe",
              },
            ],
          }),
        ]),
      }),
    );
    const source = await connectPlane(
      { url: "https://app.plane.so/acme", apiKey: API_KEY },
      { fetch: plane.fetch },
    );
    const result = await source.readProject("p1", { includeComments: false });

    const itemCall = plane.calls.find((call) =>
      call.url.pathname.endsWith("/work-items/"),
    );
    expect(itemCall?.url.searchParams.get("expand")).toBe("assignees");
    expect(result.tasks[0]?.assignee).toEqual({ name: "Jane Doe" });
    expect(result.warnings).toContain(
      "Plane did not share the project member list with this token, so some assignee emails may be missing.",
    );
  });

  it("fetches project details when the project was not listed", async () => {
    const plane = fakePlane(
      baseRoutes({
        [`${WS}/projects/`]: page([]),
        [`${PROJECT}/`]: { id: "p1", name: "Hidden" },
        [`${PROJECT}/work-items/`]: page([]),
      }),
    );
    const source = await connectPlane(
      { url: "https://app.plane.so/acme", apiKey: API_KEY },
      { fetch: plane.fetch },
    );
    const result = await source.readProject("p1", { includeComments: false });
    expect(result.name).toBe("Hidden");
    expect(result.tasks).toEqual([]);
  });
});
