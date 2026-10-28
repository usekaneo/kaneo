import { describe, expect, it } from "vite-plus/test";
import type { FetchLike } from "../types.js";
import type { TrelloBoard, TrelloCommentAction } from "./client.js";
import { KEY_REJECTED, TOKEN_REJECTED } from "./errors.js";
import { connectTrello } from "./index.js";

const API_KEY = "0123456789abcdef0123456789abcdef";
const TOKEN = "ATTAsecrettoken0123456789";

type Route = (url: URL) => unknown;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeTrello(routes: Record<string, Route>) {
  const calls: Array<{ url: URL; headers: Headers }> = [];
  const fetch: FetchLike = async (input, init) => {
    if (init?.signal?.aborted) throw init.signal.reason;
    const url = new URL(input);
    calls.push({ url, headers: new Headers(init?.headers) });
    const route = routes[url.pathname];
    if (!route)
      return new Response("The requested resource was not found.", {
        status: 404,
      });
    const result = route(url);
    return result instanceof Response ? result : json(result);
  };
  return { fetch, calls, paths: () => calls.map((call) => call.url.pathname) };
}

const me = {
  id: "m-owner",
  fullName: "Olive Owner",
  username: "olive",
  email: "olive@example.com",
};

const boardContent: TrelloBoard = {
  id: "b1",
  name: "Roadmap",
  desc: "Board notes",
  lists: [
    { id: "l-done", name: "Done", pos: 300, closed: false },
    { id: "l-todo", name: "To Do", pos: 100, closed: false },
    { id: "l-old", name: "Old", pos: 50, closed: true },
  ],
  cards: [
    {
      id: "c2",
      idShort: 2,
      name: "Second",
      idList: "l-done",
      pos: 1,
      idMembers: ["m-sam", "m-owner"],
      idLabels: ["lb-1"],
    },
    {
      id: "c1",
      idShort: 1,
      name: "First",
      desc: "Hello",
      idList: "l-todo",
      pos: 1,
      idMembers: ["m-owner"],
    },
    { id: "c0", name: "Old card", idList: "l-old", pos: 1 },
  ],
  labels: [
    { id: "lb-1", name: "", color: "purple" },
    { id: "lb-2", name: "Unused", color: "blue" },
  ],
  checklists: [
    {
      id: "cl-1",
      name: "Steps",
      idCard: "c1",
      pos: 1,
      checkItems: [{ id: "i1", name: "Do it", state: "complete", pos: 1 }],
    },
  ],
  members: [
    { id: "m-owner", fullName: "Olive Owner", username: "olive" },
    { id: "m-sam", fullName: "Sam Smith", username: "sam" },
  ],
};

function boardRoutes(extra: Record<string, Route> = {}) {
  return {
    "/1/members/me": () => me,
    "/1/boards/b1": () => boardContent,
    ...extra,
  };
}

function commentAction(index: number, cardId: string): TrelloCommentAction {
  return {
    id: `act-${String(index).padStart(5, "0")}`,
    date: new Date(Date.UTC(2024, 0, 1) + index * 60_000).toISOString(),
    idMemberCreator: "m-sam",
    data: { text: `Comment ${index}`, card: { id: cardId } },
    memberCreator: { id: "m-sam", fullName: "Sam Smith", username: "sam" },
  };
}

describe("connectTrello auth", () => {
  it("sends OAuth header auth and never puts credentials in the URL", async () => {
    const trello = fakeTrello(
      boardRoutes({
        "/1/members/me/boards": () => [],
        "/1/members/me/organizations": () => [],
        "/1/boards/b1/actions": () => [],
      }),
    );

    const source = await connectTrello(
      { apiKey: ` ${API_KEY} `, token: `${TOKEN}\n` },
      { fetch: trello.fetch },
    );
    await source.listProjects();
    await source.readProject("b1", { includeComments: true });

    expect(trello.calls.length).toBeGreaterThanOrEqual(5);
    for (const call of trello.calls) {
      expect(call.headers.get("authorization")).toBe(
        `OAuth oauth_consumer_key="${API_KEY}", oauth_token="${TOKEN}"`,
      );
      expect(call.url.origin).toBe("https://api.trello.com");
      expect(call.url.href).not.toContain(API_KEY);
      expect(call.url.href).not.toContain(TOKEN);
      expect(call.url.searchParams.has("key")).toBe(false);
      expect(call.url.searchParams.has("token")).toBe(false);
    }
    expect(trello.calls[0]?.url.pathname).toBe("/1/members/me");
    expect(trello.calls[0]?.url.searchParams.get("fields")).toBe(
      "id,fullName,username,email",
    );
  });

  it("explains a rejected token without echoing it", async () => {
    const trello = fakeTrello({
      "/1/members/me": () => new Response("invalid token", { status: 401 }),
    });

    const error = await connectTrello(
      { apiKey: API_KEY, token: TOKEN },
      { fetch: trello.fetch },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(TOKEN_REJECTED);
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it("explains a rejected API key", async () => {
    const trello = fakeTrello({
      "/1/members/me": () => new Response("invalid key", { status: 401 }),
    });

    await expect(
      connectTrello({ apiKey: API_KEY, token: TOKEN }, { fetch: trello.fetch }),
    ).rejects.toThrow(KEY_REJECTED);
  });

  it("rejects malformed or missing credentials before calling Trello", async () => {
    const trello = fakeTrello(boardRoutes());

    await expect(
      connectTrello({ apiKey: "", token: TOKEN }, { fetch: trello.fetch }),
    ).rejects.toThrow("A Trello API key is required.");
    await expect(
      connectTrello({ apiKey: API_KEY, token: " " }, { fetch: trello.fetch }),
    ).rejects.toThrow(
      "Paste the token Trello shows after you authorize Kaneo.",
    );
    const error = await connectTrello(
      { apiKey: API_KEY, token: 'ATTA"bad token' },
      { fetch: trello.fetch },
    ).then(
      () => undefined,
      (caught: unknown) => caught as Error,
    );
    expect(error?.message).toMatch(/does not look like a Trello token/);
    expect(error?.message).not.toContain("bad token");
    expect(trello.calls).toHaveLength(0);
  });

  it("reports a token that expires later on", async () => {
    let expired = false;
    const trello = fakeTrello({
      "/1/members/me": () => me,
      "/1/boards/b1": () =>
        expired ? new Response("invalid token", { status: 401 }) : boardContent,
    });
    const source = await connectTrello(
      { apiKey: API_KEY, token: TOKEN },
      { fetch: trello.fetch },
    );
    expired = true;

    await expect(
      source.readProject("b1", { includeComments: false }),
    ).rejects.toThrow(TOKEN_REJECTED);
    expect(trello.paths()).not.toContain("/1/boards/b1/lists");
  });
});

describe("listProjects", () => {
  it("lists open boards with their workspace names", async () => {
    const trello = fakeTrello({
      "/1/members/me": () => me,
      "/1/members/me/boards": () => [
        {
          id: "b2",
          name: "Website",
          url: "https://trello.com/b/2",
          idOrganization: "o1",
        },
        {
          id: "b1",
          name: "Errands",
          url: "https://trello.com/b/1",
          idOrganization: null,
        },
      ],
      "/1/members/me/organizations": () => [{ id: "o1", displayName: "Acme" }],
    });
    const source = await connectTrello(
      { apiKey: API_KEY, token: TOKEN },
      { fetch: trello.fetch },
    );

    expect(await source.listProjects()).toEqual([
      { id: "b1", name: "Errands", detail: "Personal" },
      { id: "b2", name: "Website", detail: "Acme" },
    ]);
    const boardsCall = trello.calls.find(
      (call) => call.url.pathname === "/1/members/me/boards",
    );
    expect(boardsCall?.url.searchParams.get("filter")).toBe("open");
    expect(boardsCall?.url.searchParams.get("fields")).toBe(
      "name,url,idOrganization",
    );
  });
});

describe("readProject", () => {
  it("reads the whole board in one call", async () => {
    const trello = fakeTrello(boardRoutes());
    const progress: string[] = [];
    const source = await connectTrello(
      { apiKey: API_KEY, token: TOKEN },
      { fetch: trello.fetch },
    );

    const project = await source.readProject("b1", {
      includeComments: false,
      onProgress: (message) => progress.push(message),
    });

    expect(progress).toEqual(["Reading board"]);
    expect(trello.paths()).toEqual(["/1/members/me", "/1/boards/b1"]);
    const query = trello.calls[1]?.url.searchParams;
    expect(query?.get("cards")).toBe("all");
    expect(query?.get("lists")).toBe("all");
    expect(query?.get("checklists")).toBe("all");
    expect(query?.get("card_fields")).toContain("badges");
    expect(query?.get("card_fields")?.split(",")).toContain("idShort");

    expect(project).toEqual({
      name: "Roadmap",
      description: "Board notes",
      columns: [
        { key: "l-todo", name: "To Do", isFinal: false },
        { key: "l-done", name: "Done", isFinal: true },
      ],
      labels: [{ key: "lb-1", name: "Purple", color: "#9f8fef" }],
      tasks: [
        {
          key: "c0",
          columnKey: "l-todo",
          archived: true,
          title: "Old card",
          description: "",
          priority: "no-priority",
          labelKeys: [],
          comments: [],
        },
        {
          key: "c1",
          number: 1,
          columnKey: "l-todo",
          title: "First",
          description: "Hello\n\n## Steps\n\n- [x] Do it",
          priority: "no-priority",
          assignee: { name: "Olive Owner", email: "olive@example.com" },
          labelKeys: [],
          comments: [],
        },
        {
          key: "c2",
          number: 2,
          columnKey: "l-done",
          title: "Second",
          description: "",
          priority: "no-priority",
          assignee: { name: "Sam Smith" },
          labelKeys: ["lb-1"],
          comments: [],
        },
      ],
      relations: [],
      warnings: [
        "1 card had more than one member. Kaneo keeps one assignee per task, so only the first member was kept.",
        "Trello does not share members' email addresses, so assignees are matched to Kaneo members by full name.",
      ],
    });
  });

  it("pages comments backwards with before until a short page", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, offset) =>
      commentAction(2000 - offset, offset % 2 === 0 ? "c1" : "c2"),
    );
    const secondPage = [commentAction(5, "c1"), commentAction(3, "c1")];
    const trello = fakeTrello(
      boardRoutes({
        "/1/boards/b1/actions": (url) =>
          url.searchParams.get("before") ? secondPage : firstPage,
      }),
    );
    const progress: string[] = [];
    const source = await connectTrello(
      { apiKey: API_KEY, token: TOKEN },
      { fetch: trello.fetch },
    );

    const project = await source.readProject("b1", {
      includeComments: true,
      onProgress: (message) => progress.push(message),
    });

    const actionCalls = trello.calls.filter(
      (call) => call.url.pathname === "/1/boards/b1/actions",
    );
    expect(actionCalls).toHaveLength(2);
    expect(actionCalls[0]?.url.searchParams.get("filter")).toBe("commentCard");
    expect(actionCalls[0]?.url.searchParams.get("limit")).toBe("1000");
    expect(actionCalls[0]?.url.searchParams.has("before")).toBe(false);
    expect(actionCalls[1]?.url.searchParams.get("before")).toBe("act-01001");
    expect(progress).toEqual([
      "Reading board",
      "Reading comments (1000 so far)",
      "Reading comments (1002 so far)",
    ]);

    const first = project.tasks.find((task) => task.key === "c1");
    const second = project.tasks.find((task) => task.key === "c2");
    expect(first?.comments).toHaveLength(502);
    expect(second?.comments).toHaveLength(500);
    expect(first?.comments.slice(0, 2)).toEqual([
      {
        author: { name: "Sam Smith" },
        body: "Comment 3",
        createdAt: "2024-01-01T00:03:00.000Z",
      },
      {
        author: { name: "Sam Smith" },
        body: "Comment 5",
        createdAt: "2024-01-01T00:05:00.000Z",
      },
    ]);
    expect(first?.comments.at(-1)?.body).toBe("Comment 2000");
  });

  it("splits the board into separate requests when Trello refuses the card count", async () => {
    const { lists, cards, labels, checklists, members, ...summary } =
      boardContent;
    const trello = fakeTrello({
      "/1/members/me": () => me,
      "/1/boards/b1": (url) =>
        url.searchParams.has("cards")
          ? json(
              {
                message: "API_TOO_MANY_CARDS_REQUESTED",
                error: "API_TOO_MANY_CARDS_REQUESTED",
              },
              400,
            )
          : summary,
      "/1/boards/b1/lists": () => lists,
      "/1/boards/b1/cards/all": () => cards,
      "/1/boards/b1/labels": () => labels,
      "/1/boards/b1/checklists": () => checklists,
      "/1/boards/b1/members": () => members,
    });
    const source = await connectTrello(
      { apiKey: API_KEY, token: TOKEN },
      { fetch: trello.fetch },
    );

    const project = await source.readProject("b1", { includeComments: false });

    expect(trello.paths()).toEqual([
      "/1/members/me",
      "/1/boards/b1",
      "/1/boards/b1",
      "/1/boards/b1/lists",
      "/1/boards/b1/cards/all",
      "/1/boards/b1/labels",
      "/1/boards/b1/checklists",
      "/1/boards/b1/members",
    ]);
    const listsCall = trello.calls[3]?.url.searchParams;
    expect(listsCall?.get("filter")).toBe("all");
    expect(
      trello.calls[4]?.url.searchParams.get("fields")?.split(","),
    ).toContain("idShort");
    expect(trello.calls[5]?.url.searchParams.get("limit")).toBe("1000");

    const reference = await (
      await connectTrello(
        { apiKey: API_KEY, token: TOKEN },
        { fetch: fakeTrello(boardRoutes()).fetch },
      )
    ).readProject("b1", { includeComments: false });
    expect(project).toEqual(reference);
  });

  it("skips comment requests when comments are not wanted", async () => {
    const trello = fakeTrello(boardRoutes());
    const source = await connectTrello(
      { apiKey: API_KEY, token: TOKEN },
      { fetch: trello.fetch },
    );

    await source.readProject("b1", { includeComments: false });

    expect(trello.paths()).not.toContain("/1/boards/b1/actions");
  });

  it("stops when the read is aborted", async () => {
    const trello = fakeTrello(boardRoutes());
    const source = await connectTrello(
      { apiKey: API_KEY, token: TOKEN },
      { fetch: trello.fetch },
    );
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));

    await expect(
      source.readProject("b1", {
        includeComments: false,
        signal: controller.signal,
      }),
    ).rejects.toThrow("cancelled");
  });
});
