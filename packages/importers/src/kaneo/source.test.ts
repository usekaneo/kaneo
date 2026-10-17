import { describe, expect, it, vi } from "vite-plus/test";
import type { FetchLike } from "../types.js";
import { connectKaneo } from "./index.js";

type Reply = { status: number; body: unknown };

const BASE = "https://kaneo.example.com";
const API_KEY = "key-123";

const ok = (body: unknown): Reply => ({ status: 200, body });
const fail = (status: number, message: string): Reply => ({
  status,
  body: { message, code: "ERR" },
});

function fakeFetch(routes: Record<string, Reply>) {
  const calls: Array<{ path: string; headers: Headers }> = [];
  const fetch = vi.fn<FetchLike>(async (input, init) => {
    const url = new URL(input);
    const path = `${url.pathname}${url.search}`;
    calls.push({ path, headers: new Headers(init?.headers) });
    const reply = routes[path] ?? fail(404, "Not found");
    const body =
      typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
    return new Response(body, {
      status: reply.status,
      headers: { "content-type": "application/json" },
    });
  });
  return { fetch, calls, paths: () => calls.map((call) => call.path) };
}

function boardPath(projectId: string, page: number, relatedPage = 1): string {
  const related = relatedPage > 1 ? `&relatedPage=${relatedPage}` : "";
  return `/api/task/tasks/${projectId}?page=${page}&limit=100&sortBy=position&sortOrder=asc${related}`;
}

function boardTask(id: string, status: string, extra: object = {}) {
  return {
    id,
    title: `Task ${id}`,
    number: Number(id.slice(1)),
    description: `Description of ${id}`,
    status,
    priority: "medium",
    startDate: null,
    dueDate: null,
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    userId: null,
    assigneeName: null,
    assigneeId: null,
    assigneeImage: null,
    projectId: "p1",
    subtaskCounts: { completed: 0, total: 0 },
    labels: [],
    externalLinks: [],
    ...extra,
  };
}

function boardResponse(
  data: {
    columns: object[];
    plannedTasks?: object[];
    archivedTasks?: object[];
  },
  pagination: { total: number; totalPages: number; relatedTotalPages: number },
) {
  return {
    data: {
      id: "p1",
      name: "Website",
      slug: "WEB",
      icon: null,
      description: "Project **readme**",
      isPublic: false,
      workspaceId: "ws1",
      backgroundVersion: null,
      plannedTasks: [],
      archivedTasks: [],
      ...data,
    },
    pagination: {
      page: 1,
      pageSize: 100,
      relatedPage: 1,
      relatedPageSize: 100,
      ...pagination,
    },
  };
}

const bug = { id: "l1", name: "Bug", color: "red" };
const ui = { id: "l2", name: "UI", color: "purple" };

const t1 = boardTask("t1", "to-do", {
  userId: "u1",
  assigneeName: "Ada",
  labels: [bug],
  dueDate: "2026-03-01T00:00:00.000Z",
});
const t2 = boardTask("t2", "to-do", {
  position: 1,
  priority: "urgent",
  userId: "u9",
  assigneeName: "Former Member",
  description: null,
  descriptionDeferred: true,
  externalLinks: [{ id: "e1" }],
});
const t3 = boardTask("t3", "done");
const t4 = boardTask("t4", "planned", { priority: "low" });
const t5 = boardTask("t5", "archived");

const columns = [
  {
    id: "to-do",
    slug: "to-do",
    name: "To Do",
    icon: null,
    isFinal: false,
    position: 0,
  },
  {
    id: "done",
    slug: "done",
    name: "Done",
    icon: null,
    isFinal: true,
    position: 1,
  },
];

function routes(): Record<string, Reply> {
  return {
    "/api/workspace": ok([
      { id: "ws1", name: "Acme", slug: "acme" },
      { id: "ws2", name: "Locked", slug: "locked" },
    ]),
    "/api/project?workspaceId=ws1&includeArchived=true": ok([
      { id: "p1", name: "Website", archivedAt: null },
      { id: "p2", name: "Old site", archivedAt: "2026-01-01T00:00:00.000Z" },
    ]),
    "/api/project?workspaceId=ws2&includeArchived=true": fail(403, "Forbidden"),
    [boardPath("p1", 1)]: ok(
      boardResponse(
        {
          columns: [
            { ...columns[0], tasks: [t1, t2] },
            { ...columns[1], tasks: [] },
          ],
        },
        { total: 5, totalPages: 2, relatedTotalPages: 2 },
      ),
    ),
    [boardPath("p1", 1, 2)]: ok(
      boardResponse(
        {
          columns: [
            {
              ...columns[0],
              tasks: [
                { ...t1, labels: [ui] },
                { ...t2, externalLinks: [] },
              ],
            },
          ],
        },
        { total: 5, totalPages: 2, relatedTotalPages: 2 },
      ),
    ),
    [boardPath("p1", 2)]: ok(
      boardResponse(
        {
          columns: [
            { ...columns[0], tasks: [] },
            { ...columns[1], tasks: [t3] },
          ],
          plannedTasks: [t4],
          archivedTasks: [t5],
        },
        { total: 5, totalPages: 2, relatedTotalPages: 1 },
      ),
    ),
    "/api/workspace/ws1/members": ok([
      {
        id: "u1",
        name: "Ada",
        email: "ada@example.com",
        image: null,
        role: "owner",
      },
    ]),
    "/api/custom-field/project/p1": ok([{ id: "cf1", name: "Estimate" }]),
    "/api/task/t2": ok({
      id: "t2",
      description: `Full text ![shot](${BASE}/api/asset/abc123)`,
    }),
    "/api/task-relation/t1": ok([
      {
        id: "r1",
        sourceTaskId: "t1",
        targetTaskId: "t3",
        relationType: "subtask",
      },
      {
        id: "r2",
        sourceTaskId: "t1",
        targetTaskId: "x9",
        relationType: "related",
      },
    ]),
    "/api/task-relation/t2": ok([]),
    "/api/task-relation/t3": ok([
      {
        id: "r1",
        sourceTaskId: "t1",
        targetTaskId: "t3",
        relationType: "subtask",
      },
    ]),
    "/api/task-relation/t4": ok([
      {
        id: "r3",
        sourceTaskId: "t4",
        targetTaskId: "t5",
        relationType: "blocks",
      },
    ]),
    "/api/task-relation/t5": ok([
      {
        id: "r3",
        sourceTaskId: "t4",
        targetTaskId: "t5",
        relationType: "blocks",
      },
    ]),
    "/api/activity/t1": ok([
      {
        id: "a3",
        type: "comment",
        userId: "u1",
        content: "Second",
        createdAt: "2026-01-03T00:00:00.000Z",
        externalUserName: "Ivy from Trello",
      },
      {
        id: "a2",
        type: "status_changed",
        userId: "u1",
        content: null,
        createdAt: "2026-01-02T00:00:00.000Z",
        externalUserName: null,
      },
      {
        id: "a1",
        type: "comment",
        userId: "u1",
        content: "First",
        createdAt: "2026-01-01T00:00:00.000Z",
        externalUserName: null,
      },
    ]),
    "/api/activity/t2": ok([
      {
        id: "a4",
        type: "comment",
        userId: "u7",
        content: "From a former member",
        createdAt: "2026-01-04T00:00:00.000Z",
        externalUserName: null,
      },
    ]),
    "/api/comment/t2": ok([{ id: "a4", user: { name: "Grace", image: null } }]),
    "/api/activity/t3": ok([]),
    "/api/activity/t4": ok([]),
    "/api/activity/t5": ok([]),
  };
}

describe("connectKaneo", () => {
  it("validates the key against the normalized API URL with a bearer header", async () => {
    const fake = fakeFetch(routes());
    await connectKaneo(
      { url: `${BASE}/api/`, apiKey: ` ${API_KEY} ` },
      { fetch: fake.fetch },
    );

    expect(fake.fetch).toHaveBeenCalledTimes(1);
    expect(fake.fetch.mock.calls[0]?.[0]).toBe(`${BASE}/api/workspace`);
    expect(fake.calls[0]?.headers.get("authorization")).toBe(
      `Bearer ${API_KEY}`,
    );
  });

  it("explains a rejected API key without echoing it", async () => {
    const fake = fakeFetch({ "/api/workspace": fail(401, "Unauthorized") });
    const error = await connectKaneo(
      { url: BASE, apiKey: API_KEY },
      { fetch: fake.fetch },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/rejected the API key/);
    expect((error as Error).message).not.toContain(API_KEY);
  });

  it("falls back to the organization list on older instances", async () => {
    const fake = fakeFetch({
      "/api/auth/organization/list": ok([{ id: "ws1", name: "Acme" }]),
      "/api/project?workspaceId=ws1&includeArchived=true": ok([
        { id: "p1", name: "Website" },
      ]),
    });
    const source = await connectKaneo(
      { url: BASE, apiKey: API_KEY },
      { fetch: fake.fetch },
    );

    expect(await source.listProjects()).toEqual([
      { id: "p1", name: "Website", detail: "Acme" },
    ]);
  });

  it("reports a URL that does not serve the Kaneo API", async () => {
    const fake = fakeFetch({
      "/api/workspace": ok("<!doctype html><html></html>"),
    });

    await expect(
      connectKaneo({ url: BASE, apiKey: API_KEY }, { fetch: fake.fetch }),
    ).rejects.toThrow(`No Kaneo API answered at ${BASE}`);
  });

  it("requires a URL and an API key", async () => {
    await expect(connectKaneo({ url: " ", apiKey: API_KEY })).rejects.toThrow(
      /URL/,
    );
    await expect(connectKaneo({ url: BASE, apiKey: "" })).rejects.toThrow(
      /API key/,
    );
  });
});

describe("listProjects", () => {
  it("lists projects of every readable workspace and flags archived ones", async () => {
    const fake = fakeFetch(routes());
    const source = await connectKaneo(
      { url: BASE, apiKey: API_KEY },
      { fetch: fake.fetch },
    );

    expect(await source.listProjects()).toEqual([
      { id: "p1", name: "Website", detail: "Acme" },
      { id: "p2", name: "Old site", detail: "Acme (archived)" },
    ]);
  });
});

describe("readProject", () => {
  it("reads the whole board with comments, relations and warnings", async () => {
    const fake = fakeFetch(routes());
    const source = await connectKaneo(
      { url: BASE, apiKey: API_KEY },
      { fetch: fake.fetch },
    );
    const progress: string[] = [];

    const project = await source.readProject("p1", {
      includeComments: true,
      onProgress: (message) => progress.push(message),
    });

    expect(project.name).toBe("Website");
    expect(project.key).toBe("WEB");
    expect(project.description).toBe("Project **readme**");
    expect(project.columns).toEqual([
      { key: "to-do", name: "To Do", isFinal: false },
      { key: "done", name: "Done", isFinal: true },
    ]);
    expect(project.labels).toEqual([
      { key: "Bug", name: "Bug", color: "#dc2626" },
      { key: "UI", name: "UI", color: "#8b5cf6" },
    ]);
    expect(
      project.tasks.map((task) => [
        task.key,
        task.columnKey,
        task.archived ?? false,
      ]),
    ).toEqual([
      ["t1", "to-do", false],
      ["t2", "to-do", false],
      ["t3", "done", false],
      ["t4", null, false],
      ["t5", null, true],
    ]);
    expect(project.tasks.map((task) => task.number)).toEqual([1, 2, 3, 4, 5]);

    const [first, second] = project.tasks;
    expect(first).toMatchObject({
      title: "Task t1",
      description: "Description of t1",
      priority: "medium",
      dueDate: "2026-03-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      assignee: { name: "Ada", email: "ada@example.com" },
      labelKeys: ["Bug", "UI"],
      comments: [
        {
          author: { name: "Ada", email: "ada@example.com" },
          body: "First",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          author: { name: "Ivy from Trello" },
          body: "Second",
          createdAt: "2026-01-03T00:00:00.000Z",
        },
      ],
    });
    expect(second).toMatchObject({
      priority: "urgent",
      description: `Full text ![shot](${BASE}/api/asset/abc123)`,
      assignee: { name: "Former Member" },
      comments: [{ author: { name: "Grace" }, body: "From a former member" }],
    });
    expect(second?.assignee?.email).toBeUndefined();

    expect(project.relations).toEqual([
      { sourceKey: "t1", targetKey: "t3", type: "subtask" },
      { sourceKey: "t4", targetKey: "t5", type: "blocks" },
    ]);

    expect(project.warnings).toEqual([
      "1 task has an assignee whose email address could not be found, so the assignee may not carry over.",
      "Custom fields are not copied: Estimate.",
      "1 task has integration links (such as GitHub issues) that are not copied.",
      "1 task references images or files stored on the source instance. They are not copied and may not display.",
      "1 task link points to tasks in other projects and is not copied.",
    ]);
    for (const warning of project.warnings)
      expect(warning).not.toContain(String.fromCharCode(0x2014));

    expect(progress).toEqual([
      "Reading tasks (2 of 5)",
      "Reading tasks (5 of 5)",
      "Reading comments and task links (5 of 5)",
    ]);
    expect(
      fake.paths().filter((path) => path.startsWith("/api/comment/")),
    ).toEqual(["/api/comment/t2"]);
    for (const call of fake.calls) {
      expect(call.path).not.toContain(API_KEY);
      expect(call.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
    }
  });

  it("skips comment requests when comments are not wanted", async () => {
    const fake = fakeFetch(routes());
    const source = await connectKaneo(
      { url: BASE, apiKey: API_KEY },
      { fetch: fake.fetch },
    );

    const project = await source.readProject("p1", { includeComments: false });

    expect(project.tasks.every((task) => task.comments.length === 0)).toBe(
      true,
    );
    expect(
      fake
        .paths()
        .some(
          (path) =>
            path.startsWith("/api/activity/") ||
            path.startsWith("/api/comment/"),
        ),
    ).toBe(false);
  });

  it("degrades gracefully on an older instance", async () => {
    const legacyBoard = {
      id: "p1",
      name: "Website",
      description: null,
      workspaceId: "ws1",
      columns: [
        { id: "to-do", name: "To Do", tasks: [boardTask("t1", "to-do")] },
        { id: "done", name: "Done", tasks: [boardTask("t3", "done")] },
      ],
    };
    const fake = fakeFetch({
      "/api/auth/organization/list": ok([{ id: "ws1", name: "Acme" }]),
      [boardPath("p1", 1)]: ok(legacyBoard),
      "/api/activity/t1": ok([]),
      "/api/activity/t3": ok([]),
    });
    const source = await connectKaneo(
      { url: BASE, apiKey: API_KEY },
      { fetch: fake.fetch },
    );

    const project = await source.readProject("p1", { includeComments: true });

    expect(project.columns).toEqual([
      { key: "to-do", name: "To Do", isFinal: false },
      { key: "done", name: "Done", isFinal: true },
    ]);
    expect(project.tasks.map((task) => task.key)).toEqual(["t1", "t3"]);
    expect(project.relations).toEqual([]);
    expect(project.warnings).toEqual([
      "Workspace members could not be read, so assignees and comment authors carry over by name only.",
      "This Kaneo version does not expose task links, so they are not copied.",
    ]);
    expect(
      fake.paths().filter((path) => path.startsWith("/api/task-relation/")),
    ).toHaveLength(1);
  });

  it("leaves custom fields out quietly when the instance has none", async () => {
    const fake = fakeFetch({
      ...routes(),
      "/api/custom-field/project/p1": fail(404, "Not found"),
    });
    const source = await connectKaneo(
      { url: BASE, apiKey: API_KEY },
      { fetch: fake.fetch },
    );

    const project = await source.readProject("p1", { includeComments: false });

    expect(
      project.warnings.filter((warning) => warning.includes("Custom fields")),
    ).toEqual([]);
  });

  it("continues with a warning when the API key may not read custom fields", async () => {
    const fake = fakeFetch({
      ...routes(),
      "/api/custom-field/project/p1": fail(403, "Forbidden"),
    });
    const source = await connectKaneo(
      { url: BASE, apiKey: API_KEY },
      { fetch: fake.fetch },
    );

    const project = await source.readProject("p1", { includeComments: false });

    expect(project.tasks).toHaveLength(5);
    expect(
      project.warnings.filter((warning) => warning.includes("Custom fields")),
    ).toEqual([
      "Custom fields could not be read with this API key, so they are not listed here.",
    ]);
  });

  it.each([401, 400, 500])(
    "stops when reading custom fields fails with HTTP %i",
    async (status) => {
      const fake = fakeFetch({
        ...routes(),
        "/api/custom-field/project/p1": fail(status, "Nope"),
      });
      const source = await connectKaneo(
        { url: BASE, apiKey: API_KEY },
        { fetch: fake.fetch },
      );

      await expect(
        source.readProject("p1", { includeComments: false }),
      ).rejects.toMatchObject({ name: "SourceHttpError", status });
    },
  );

  it("skips tasks deleted while reading", async () => {
    const fake = fakeFetch({
      ...routes(),
      "/api/task-relation/t3": fail(404, "Task not found"),
      "/api/activity/t3": fail(404, "Task not found"),
    });
    const source = await connectKaneo(
      { url: BASE, apiKey: API_KEY },
      { fetch: fake.fetch },
    );

    const project = await source.readProject("p1", { includeComments: true });

    expect(project.warnings).not.toContain(
      "This Kaneo version does not expose task links, so they are not copied.",
    );
    expect(fake.paths()).toContain("/api/task-relation/t4");
    expect(project.relations).toContainEqual({
      sourceKey: "t1",
      targetKey: "t3",
      type: "subtask",
    });
  });
});
