import { describe, expect, it, vi } from "vite-plus/test";
import type { FetchLike } from "../types.js";
import { connectPlanka } from "./source.js";

const BASE = "https://planka.example.com";

type Call = { method: string; path: string; headers: Headers; body?: string };

function fakePlanka(routes: Record<string, unknown>) {
  const calls: Call[] = [];
  const fetch: FetchLike = vi.fn(async (url: string, init?: RequestInit) => {
    init?.signal?.throwIfAborted();
    const path = url.slice(BASE.length);
    const method = init?.method ?? "GET";
    calls.push({
      method,
      path,
      headers: new Headers(init?.headers),
      ...(typeof init?.body === "string" ? { body: init.body } : {}),
    });
    const key = `${method} ${path}`;
    if (!(key in routes)) {
      return new Response(JSON.stringify({ code: "E_NOT_FOUND" }), {
        status: 404,
      });
    }
    const route = routes[key];
    if (route instanceof Response) return route;
    return new Response(JSON.stringify(route), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { calls, fetch };
}

const projects = {
  items: [
    { id: "p1", name: "Marketing" },
    { id: "p2", name: "Ops" },
  ],
  included: {
    boards: [
      { id: "b2", projectId: "p1", name: "Campaigns", position: 2 },
      { id: "b1", projectId: "p1", name: "Content", position: 1 },
      { id: "b3", projectId: "p2", name: "Main", position: 1 },
    ],
  },
};

function card(partial: Record<string, unknown> & { id: string }) {
  return {
    boardId: "b1",
    listId: "l_todo",
    name: partial.id,
    description: null,
    position: 0,
    dueDate: null,
    isDueCompleted: null,
    isClosed: false,
    commentsTotal: 0,
    ...partial,
  };
}

const board = {
  item: { id: "b1", projectId: "p1", name: "Content", position: 1 },
  included: {
    lists: [
      {
        id: "l_trash",
        boardId: "b1",
        name: null,
        type: "trash",
        position: null,
        color: null,
      },
      {
        id: "l_done",
        boardId: "b1",
        name: "Done",
        type: "closed",
        position: 3,
        color: null,
      },
      {
        id: "l_todo",
        boardId: "b1",
        name: "To Do",
        type: "active",
        position: 1,
        color: null,
      },
      {
        id: "l_doing",
        boardId: "b1",
        name: "  ",
        type: "active",
        position: 2,
        color: null,
      },
      {
        id: "l_archive",
        boardId: "b1",
        name: null,
        type: "archive",
        position: null,
        color: null,
      },
    ],
    cards: [
      card({ id: "c2", name: "Second", position: 2 }),
      card({
        id: "c1",
        name: "First",
        position: 1,
        description: "Ship it",
        dueDate: "2026-03-04T10:00:00.000Z",
        createdAt: "2026-01-02T08:00:00.000Z",
        commentsTotal: 2,
      }),
      card({ id: "c3", name: "Third", listId: "l_done", position: 3 }),
      card({ id: "c_old", listId: "l_archive", position: 0, commentsTotal: 4 }),
    ],
    labels: [
      {
        id: "lb2",
        boardId: "b1",
        name: null,
        color: "sunny-grass",
        position: 2,
      },
      {
        id: "lb1",
        boardId: "b1",
        name: "Bug",
        color: "berry-red",
        position: 1,
      },
      {
        id: "lb3",
        boardId: "b1",
        name: "Unused",
        color: "egg-yellow",
        position: 3,
      },
    ],
    cardLabels: [
      { cardId: "c1", labelId: "lb2" },
      { cardId: "c1", labelId: "lb1" },
      { cardId: "c3", labelId: "lb1" },
      { cardId: "c_old", labelId: "lb3" },
    ],
    cardMemberships: [
      { cardId: "c1", userId: "u1" },
      { cardId: "c1", userId: "u2" },
      { cardId: "c2", userId: "u2" },
    ],
    taskLists: [
      { id: "tl1", cardId: "c1", name: "Steps" },
      { id: "tl2", cardId: "c2", name: "Links" },
    ],
    tasks: [
      {
        id: "t2",
        taskListId: "tl1",
        name: "Review",
        isCompleted: false,
        position: 2,
      },
      {
        id: "t1",
        taskListId: "tl1",
        name: "Write",
        isCompleted: true,
        position: 1,
      },
      {
        id: "t3",
        taskListId: "tl2",
        name: "",
        isCompleted: false,
        position: 1,
        linkedCardId: "c3",
      },
      {
        id: "t4",
        taskListId: "tl2",
        name: "",
        isCompleted: false,
        position: 2,
        linkedCardId: "c2",
      },
      {
        id: "t5",
        taskListId: "tl2",
        name: "",
        isCompleted: false,
        position: 3,
        linkedCardId: "c_elsewhere",
      },
      {
        id: "t6",
        taskListId: "tl2",
        name: "",
        isCompleted: false,
        position: 4,
        linkedCardId: "c3",
      },
    ],
    attachments: [
      { id: "a1", cardId: "c1" },
      { id: "a2", cardId: "c2" },
      { id: "a3", cardId: "c_old" },
    ],
    users: [
      { id: "u1", name: "Sam", username: "sam" },
      { id: "u2", name: null, username: "ana", email: "ana@example.com" },
    ],
  },
};

const commentRoutes = {
  "GET /api/cards/c1/comments": {
    items: [
      {
        id: "m2",
        cardId: "c1",
        userId: "u3",
        text: "Second note",
        createdAt: "2026-02-02T09:00:00.000Z",
      },
      {
        id: "m1",
        cardId: "c1",
        userId: "u2",
        text: "First note",
        createdAt: "2026-02-01T09:00:00.000Z",
      },
    ],
    included: {
      users: [
        { id: "u3", name: "Lee", username: "lee", email: "lee@example.com" },
      ],
    },
  },
  "GET /api/cards/c1/comments?beforeId=m1": { items: [] },
};

const routes = {
  "GET /api/projects": projects,
  "GET /api/boards/b1": board,
  ...commentRoutes,
};

describe("connectPlanka", () => {
  it("validates an API key with one projects request sent in x-api-key", async () => {
    const { calls, fetch } = fakePlanka(routes);

    await connectPlanka(
      { url: "planka.example.com/", apiKey: " key-1 " },
      { fetch },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe("/api/projects");
    expect(calls[0]?.headers.get("x-api-key")).toBe("key-1");
    expect(calls[0]?.headers.get("authorization")).toBeNull();
  });

  it("logs in with a username and password and then uses the bearer token", async () => {
    const { calls, fetch } = fakePlanka({
      ...routes,
      "POST /api/access-tokens": { item: "jwt-1" },
    });

    await connectPlanka(
      { url: BASE, username: "sam", password: "pw" },
      { fetch },
    );

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "POST /api/access-tokens",
      "GET /api/projects",
    ]);
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({
      emailOrUsername: "sam",
      password: "pw",
    });
    expect(calls[1]?.headers.get("authorization")).toBe("Bearer jwt-1");
  });

  it("prefers the API key over a username and password", async () => {
    const { calls, fetch } = fakePlanka(routes);

    await connectPlanka(
      { url: BASE, apiKey: "key-1", username: "sam", password: "pw" },
      { fetch },
    );

    expect(calls.map((call) => call.path)).toEqual(["/api/projects"]);
  });

  it("rejects missing credentials without any request", async () => {
    const { calls, fetch } = fakePlanka(routes);

    await expect(
      connectPlanka({ url: BASE, username: "sam" }, { fetch }),
    ).rejects.toThrow(
      "Enter a PLANKA API key, or the username and password of a PLANKA account.",
    );
    await expect(
      connectPlanka({ url: " ", apiKey: "key-1" }, { fetch }),
    ).rejects.toThrow("Enter the URL of your PLANKA instance.");
    expect(calls).toHaveLength(0);
  });

  it("reports an invalid API key without echoing it", async () => {
    const { fetch } = fakePlanka({
      "GET /api/projects": new Response("{}", { status: 401 }),
    });

    const error: unknown = await connectPlanka(
      { url: BASE, apiKey: "bad-key" },
      { fetch },
    ).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "PLANKA /api/projects: unauthorized (HTTP 401), check your PLANKA credentials or token",
    );
    expect((error as Error).message).not.toContain("bad-key");
  });
});

describe("listProjects", () => {
  it("lists one entry per board, qualified by board when a project has several", async () => {
    const { fetch } = fakePlanka(routes);
    const source = await connectPlanka({ url: BASE, apiKey: "k" }, { fetch });

    expect(await source.listProjects()).toEqual([
      { id: "b1", name: "Marketing - Content", detail: "Marketing" },
      { id: "b2", name: "Marketing - Campaigns", detail: "Marketing" },
      { id: "b3", name: "Ops", detail: "Ops" },
    ]);
  });
});

describe("readProject", () => {
  async function read(includeComments = true) {
    const { calls, fetch } = fakePlanka(routes);
    const source = await connectPlanka({ url: BASE, apiKey: "k" }, { fetch });
    const progress: string[] = [];
    const project = await source.readProject("b1", {
      includeComments,
      onProgress: (message) => progress.push(message),
    });
    return { project, progress, calls };
  }

  it("names the project like listProjects", async () => {
    const { project } = await read();
    expect(project.name).toBe("Marketing - Content");
  });

  it("maps active and closed lists to ordered columns with closed as final", async () => {
    const { project } = await read();

    expect(project.columns).toEqual([
      { key: "l_todo", name: "To Do", isFinal: false },
      { key: "l_doing", name: "Untitled", isFinal: false },
      { key: "l_done", name: "Done", isFinal: true },
    ]);
  });

  it("maps cards to tasks in board order", async () => {
    const { project } = await read();

    expect(project.tasks.map((task) => [task.key, task.columnKey])).toEqual([
      ["c1", "l_todo"],
      ["c2", "l_todo"],
      ["c3", "l_done"],
    ]);

    const first = project.tasks[0];
    expect(first).toMatchObject({
      title: "First",
      description: "Ship it\n\n## Steps\n\n- [x] Write\n- [ ] Review",
      priority: "no-priority",
      dueDate: "2026-03-04T10:00:00.000Z",
      createdAt: "2026-01-02T08:00:00.000Z",
      labelKeys: ["lb2", "lb1"],
    });
    expect(project.tasks[1]?.description).toBe("");
  });

  it("keeps only used labels with hex colors in label order", async () => {
    const { project } = await read();

    expect(project.labels).toEqual([
      { key: "lb1", name: "Bug", color: "#e83855" },
      { key: "lb2", name: "sunny-grass", color: "#beca02" },
    ]);
  });

  it("assigns the first card member and keeps the email when PLANKA shares it", async () => {
    const { project } = await read();

    expect(project.tasks[0]?.assignee).toEqual({ name: "Sam" });
    expect(project.tasks[1]?.assignee).toEqual({
      name: "ana",
      email: "ana@example.com",
    });
    expect(project.tasks[2]?.assignee).toBeUndefined();
  });

  it("reads comments oldest first with their authors and original dates", async () => {
    const { project, calls } = await read();

    expect(project.tasks[0]?.comments).toEqual([
      {
        author: { name: "ana", email: "ana@example.com" },
        body: "First note",
        createdAt: "2026-02-01T09:00:00.000Z",
      },
      {
        author: { name: "Lee", email: "lee@example.com" },
        body: "Second note",
        createdAt: "2026-02-02T09:00:00.000Z",
      },
    ]);
    expect(project.tasks[1]?.comments).toEqual([]);
    expect(
      calls
        .filter((call) => call.path.includes("/comments"))
        .map((c) => c.path),
    ).toEqual(["/api/cards/c1/comments", "/api/cards/c1/comments?beforeId=m1"]);
  });

  it("skips comment requests when comments are not wanted", async () => {
    const { project, calls } = await read(false);

    expect(calls.some((call) => call.path.includes("/comments"))).toBe(false);
    expect(project.tasks[0]?.comments).toEqual([]);
  });

  it("turns linked checklist items into subtask relations inside the board", async () => {
    const { project } = await read();

    expect(project.relations).toEqual([
      { sourceKey: "c2", targetKey: "c3", type: "subtask" },
    ]);
  });

  it("warns about attachments, extra members, hidden emails and outside links", async () => {
    const { project } = await read();

    expect(project.warnings).toEqual([
      "2 attachments were not imported.",
      "1 card had more than one member. Kaneo keeps one assignee per task, so only the first member was assigned.",
      "PLANKA hid the assignee email on 1 card. Connect with a PLANKA admin account so assignees can be matched by email.",
      "1 checklist item linked to cards on other boards and was not imported.",
    ]);
  });

  it("reports progress while reading", async () => {
    const { progress } = await read();

    expect(progress).toEqual([
      "Reading board Marketing - Content",
      "Reading comments (1 of 1 cards)",
    ]);
  });

  it("fails clearly for a board that is not listed", async () => {
    const { calls, fetch } = fakePlanka(routes);
    const source = await connectPlanka({ url: BASE, apiKey: "k" }, { fetch });

    await expect(
      source.readProject("gone", { includeComments: false }),
    ).rejects.toThrow("This PLANKA board was not found.");
    expect(calls.map((call) => call.path)).toEqual([
      "/api/projects",
      "/api/projects",
    ]);
  });

  it("fails clearly when a listed board no longer exists", async () => {
    const { fetch } = fakePlanka({ "GET /api/projects": projects });
    const source = await connectPlanka({ url: BASE, apiKey: "k" }, { fetch });

    await expect(
      source.readProject("b2", { includeComments: false }),
    ).rejects.toThrow("This PLANKA board was not found.");
  });

  it("passes the read signal to every request", async () => {
    const { calls, fetch } = fakePlanka(routes);
    const source = await connectPlanka({ url: BASE, apiKey: "k" }, { fetch });
    const controller = new AbortController();
    controller.abort();

    await expect(
      source.readProject("b1", {
        includeComments: false,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(calls.map((call) => call.path)).toEqual(["/api/projects"]);
  });
});
