import { describe, expect, it } from "vite-plus/test";
import type {
  TrelloBoard,
  TrelloCard,
  TrelloList,
  TrelloMember,
} from "./client.js";
import { cardCreatedAt, mapBoard, mapColumns, mapLabel } from "./mapping.js";

const owner: TrelloMember = {
  id: "m-owner",
  fullName: "Olive Owner",
  username: "olive",
  email: "olive@example.com",
};

function list(id: string, name: string, pos: number, closed = false) {
  return { id, name, pos, closed } satisfies TrelloList;
}

function card(
  id: string,
  idList: string,
  pos: number,
  extra: Partial<TrelloCard> = {},
): TrelloCard {
  return { id, name: `Card ${id}`, idList, pos, closed: false, ...extra };
}

function board(overrides: Partial<TrelloBoard> = {}): TrelloBoard {
  return {
    id: "b1",
    name: "Roadmap",
    desc: "",
    lists: [list("l-todo", "To Do", 100)],
    cards: [],
    labels: [],
    checklists: [],
    members: [],
    ...overrides,
  };
}

describe("mapColumns", () => {
  it("keeps open lists in order and marks a done-like last list final", () => {
    const project = mapBoard(
      board({
        lists: [
          list("l-done", "Done", 300),
          list("l-todo", "To Do", 100),
          list("l-old", "Old ideas", 150, true),
          list("l-doing", "Doing", 200),
        ],
      }),
      { owner },
    );

    expect(project.columns).toEqual([
      { key: "l-todo", name: "To Do", isFinal: false },
      { key: "l-doing", name: "Doing", isFinal: false },
      { key: "l-done", name: "Done", isFinal: true },
    ]);
  });

  it("marks nothing final when the last list is not done-like", () => {
    expect(
      mapColumns([list("l-done", "Done", 1), list("l-later", "Later", 2)]),
    ).toEqual([
      { key: "l-done", name: "Done", isFinal: false },
      { key: "l-later", name: "Later", isFinal: false },
    ]);
  });

  it("recognizes other done-like names", () => {
    for (const name of ["Completed", "closed", "Shipped 🚀", "Finished"]) {
      expect(mapColumns([list("l", name, 1)])[0]?.isFinal).toBe(true);
    }
    expect(mapColumns([list("l", "Not done", 1)])[0]?.isFinal).toBe(false);
  });
});

describe("mapBoard tasks", () => {
  it("orders cards by list position, then card position", () => {
    const project = mapBoard(
      board({
        lists: [list("l-b", "B", 200), list("l-a", "A", 100)],
        cards: [
          card("c-b2", "l-b", 20),
          card("c-a2", "l-a", 50),
          card("c-b1", "l-b", 10),
          card("c-a1", "l-a", 5),
        ],
      }),
      { owner },
    );

    expect(project.tasks.map((task) => [task.key, task.columnKey])).toEqual([
      ["c-a1", "l-a"],
      ["c-a2", "l-a"],
      ["c-b1", "l-b"],
      ["c-b2", "l-b"],
    ]);
  });

  it("keeps the card's short number and no project key", () => {
    const project = mapBoard(
      board({
        cards: [
          card("c1", "l-todo", 1, { idShort: 14 }),
          card("c2", "l-todo", 2),
        ],
      }),
      { owner },
    );

    expect(project.tasks.map((task) => task.number)).toEqual([14, undefined]);
    expect(project).not.toHaveProperty("key");
  });

  it("archives closed cards and cards in closed lists", () => {
    const project = mapBoard(
      board({
        lists: [
          list("l-old", "Old", 50, true),
          list("l-todo", "To Do", 100),
          list("l-doing", "Doing", 200),
        ],
        cards: [
          card("c-open", "l-doing", 1),
          card("c-closed", "l-doing", 2, { closed: true }),
          card("c-in-closed-list", "l-old", 1),
        ],
      }),
      { owner },
    );

    const byKey = new Map(project.tasks.map((task) => [task.key, task]));
    expect(byKey.get("c-open")).toMatchObject({ columnKey: "l-doing" });
    expect(byKey.get("c-open")?.archived).toBeUndefined();
    expect(byKey.get("c-closed")).toMatchObject({
      columnKey: "l-doing",
      archived: true,
    });
    expect(byKey.get("c-in-closed-list")).toMatchObject({
      columnKey: "l-todo",
      archived: true,
    });
    expect(project.columns.map((column) => column.key)).toEqual([
      "l-todo",
      "l-doing",
    ]);
  });

  it("uses no column when the board has no open lists", () => {
    const project = mapBoard(
      board({
        lists: [list("l-old", "Old", 1, true)],
        cards: [card("c1", "l-old", 1)],
      }),
      { owner },
    );

    expect(project.columns).toEqual([]);
    expect(project.tasks[0]).toMatchObject({ columnKey: null, archived: true });
  });

  it("folds checklists into the description in position order", () => {
    const project = mapBoard(
      board({
        cards: [
          card("c1", "l-todo", 1, { desc: "Ship it\n\n- with **care**" }),
        ],
        checklists: [
          {
            id: "cl-2",
            name: "Launch",
            idCard: "c1",
            pos: 200,
            checkItems: [
              { id: "i3", name: "Announce", state: "incomplete", pos: 2 },
            ],
          },
          {
            id: "cl-1",
            name: "Prep",
            idCard: "c1",
            pos: 100,
            checkItems: [
              { id: "i2", name: "Test", state: "incomplete", pos: 20 },
              { id: "i1", name: "Build", state: "complete", pos: 10 },
            ],
          },
          { id: "cl-empty", name: "Empty", idCard: "c1", pos: 300 },
          {
            id: "cl-other",
            name: "Other",
            idCard: "c-other",
            pos: 1,
            checkItems: [{ id: "i9", name: "x", state: "complete", pos: 1 }],
          },
        ],
      }),
      { owner },
    );

    expect(project.tasks[0]?.description).toBe(
      [
        "Ship it\n\n- with **care**",
        "## Prep\n\n- [x] Build\n- [ ] Test",
        "## Launch\n\n- [ ] Announce",
      ].join("\n\n"),
    );
  });

  it("maps dates, a fixed priority, and the creation time from the card id", () => {
    const project = mapBoard(
      board({
        cards: [
          card("5f0000000000000000000001", "l-todo", 1, {
            due: "2024-05-01T12:00:00.000Z",
            start: "2024-04-01T00:00:00.000Z",
          }),
        ],
      }),
      { owner },
    );

    expect(project.tasks[0]).toMatchObject({
      priority: "no-priority",
      startDate: "2024-04-01T00:00:00.000Z",
      dueDate: "2024-05-01T12:00:00.000Z",
      createdAt: "2020-07-04T04:05:20.000Z",
    });
  });

  it("passes comments through by card id", () => {
    const comment = { author: { name: "Sam" }, body: "Hi" };
    const project = mapBoard(board({ cards: [card("c1", "l-todo", 1)] }), {
      owner,
      comments: new Map([["c1", [comment]]]),
    });

    expect(project.tasks[0]?.comments).toEqual([comment]);
  });

  it("keeps the board description", () => {
    expect(mapBoard(board({ desc: " About this board " }), { owner })).toEqual(
      expect.objectContaining({
        name: "Roadmap",
        description: "About this board",
      }),
    );
    expect(mapBoard(board(), { owner }).description).toBeUndefined();
  });
});

describe("mapBoard labels", () => {
  it("returns only used labels with names and hex colors", () => {
    const project = mapBoard(
      board({
        labels: [
          { id: "lb-bug", name: "Bug", color: "red" },
          { id: "lb-green", name: "", color: "green_dark" },
          { id: "lb-plain", name: "Plain", color: null },
          { id: "lb-high", name: "High", color: "orange" },
          { id: "lb-unused", name: "Unused", color: "blue" },
        ],
        cards: [
          card("c1", "l-todo", 1, {
            idLabels: ["lb-bug", "lb-green", "lb-missing", "lb-bug"],
          }),
          card("c2", "l-todo", 2, { idLabels: ["lb-plain", "lb-high"] }),
        ],
      }),
      { owner },
    );

    expect(project.labels).toEqual([
      { key: "lb-bug", name: "Bug", color: "#f87168" },
      { key: "lb-green", name: "Green dark", color: "#1f845a" },
      { key: "lb-plain", name: "Plain", color: "#6b7280" },
      { key: "lb-high", name: "High", color: "#fea362" },
    ]);
    expect(project.tasks.map((task) => task.labelKeys)).toEqual([
      ["lb-bug", "lb-green"],
      ["lb-plain", "lb-high"],
    ]);
    expect(project.tasks[1]?.priority).toBe("no-priority");
  });

  it("names a label without name or color", () => {
    expect(mapLabel({ id: "x", name: " ", color: null })).toEqual({
      key: "x",
      name: "Label",
      color: "#6b7280",
    });
  });
});

describe("mapBoard assignees and warnings", () => {
  const members: TrelloMember[] = [
    { id: "m-sam", fullName: "Sam Smith", username: "sam" },
    { id: "m-owner", fullName: "Olive Owner", username: "olive" },
    { id: "m-nameless", fullName: "", username: "ghost" },
  ];

  it("assigns the first member and only fills the owner's email", () => {
    const project = mapBoard(
      board({
        members,
        cards: [
          card("c1", "l-todo", 1, { idMembers: ["m-sam", "m-owner"] }),
          card("c2", "l-todo", 2, { idMembers: ["m-owner"] }),
          card("c3", "l-todo", 3, { idMembers: ["m-nameless"] }),
          card("c4", "l-todo", 4, { idMembers: ["m-gone", "m-sam"] }),
          card("c5", "l-todo", 5),
        ],
      }),
      { owner },
    );

    expect(project.tasks.map((task) => task.assignee)).toEqual([
      { name: "Sam Smith" },
      { name: "Olive Owner", email: "olive@example.com" },
      { name: "ghost" },
      { name: "Sam Smith" },
      undefined,
    ]);
    expect(project.warnings).toEqual([
      "2 cards had more than one member. Kaneo keeps one assignee per task, so only the first member was kept.",
      "Trello does not share members' email addresses, so assignees are matched to Kaneo members by full name.",
    ]);
  });

  it("skips the email warning when only the token owner is assigned", () => {
    const project = mapBoard(
      board({
        members,
        cards: [card("c1", "l-todo", 1, { idMembers: ["m-owner"] })],
      }),
      { owner },
    );

    expect(project.warnings).toEqual([]);
  });

  it("warns about attachments and other Trello-only data", () => {
    const project = mapBoard(
      board({
        cards: [
          card("c1", "l-todo", 1, { badges: { attachments: 2 } }),
          card("c2", "l-todo", 2, { badges: { attachments: 0 } }),
        ],
      }),
      { owner },
    );

    expect(project.warnings).toEqual([
      "Attachments on 1 card, custom fields, Power-Up data, and stickers are not imported.",
    ]);
    expect(project.relations).toEqual([]);
  });
});

describe("cardCreatedAt", () => {
  it("reads the timestamp from a Trello id and ignores other ids", () => {
    expect(cardCreatedAt("600000000000000000000000")).toBe(
      "2021-01-14T08:25:36.000Z",
    );
    expect(cardCreatedAt("c1")).toBeUndefined();
  });
});
