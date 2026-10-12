import { describe, expect, it } from "vite-plus/test";
import type { KaneoActivity, KaneoBoardTask, KaneoMember } from "./client.js";
import {
  collectLabels,
  mapColumns,
  mapComments,
  mapPriority,
  mapRelations,
  mapTask,
  needsAuthorNames,
  UNKNOWN_AUTHOR,
} from "./mapping.js";

function task(overrides: Partial<KaneoBoardTask> = {}): KaneoBoardTask {
  return {
    id: "t1",
    title: "Write docs",
    number: 1,
    description: "Some **markdown**",
    status: "to-do",
    priority: "high",
    position: 0,
    userId: null,
    labels: [],
    externalLinks: [],
    ...overrides,
  };
}

function activity(overrides: Partial<KaneoActivity>): KaneoActivity {
  return {
    id: "a1",
    type: "comment",
    userId: "u1",
    content: "Hello",
    createdAt: "2026-01-01T10:00:00.000Z",
    externalUserName: null,
    ...overrides,
  };
}

const members = new Map<string, KaneoMember>([
  ["u1", { id: "u1", name: "Ada", email: "ada@example.com" }],
]);

describe("mapPriority", () => {
  it("passes Kaneo priorities through", () => {
    expect(mapPriority("urgent")).toBe("urgent");
    expect(mapPriority("no-priority")).toBe("no-priority");
    expect(mapPriority("Medium")).toBe("medium");
  });

  it("falls back to no-priority", () => {
    expect(mapPriority(null)).toBe("no-priority");
    expect(mapPriority("critical")).toBe("no-priority");
  });
});

describe("mapColumns", () => {
  it("uses the slug as key and keeps isFinal", () => {
    expect(
      mapColumns([
        { id: "to-do", slug: "to-do", name: "To Do", isFinal: false },
        { id: "shipped", slug: "shipped", name: "Shipped", isFinal: true },
      ]),
    ).toEqual([
      { key: "to-do", name: "To Do", isFinal: false },
      { key: "shipped", name: "Shipped", isFinal: true },
    ]);
  });

  it("treats a legacy done column as final when isFinal is missing", () => {
    expect(mapColumns([{ id: "done", name: "Done" }])).toEqual([
      { key: "done", name: "Done", isFinal: true },
    ]);
  });
});

describe("collectLabels", () => {
  it("dedupes by name and converts colors", () => {
    expect(
      collectLabels([
        task({ labels: [{ id: "l1", name: "Bug", color: "red" }] }),
        task({
          id: "t2",
          labels: [
            { id: "l2", name: "Bug", color: "red" },
            { id: "l3", name: "UI", color: "#ABC" },
          ],
        }),
      ]),
    ).toEqual([
      { key: "Bug", name: "Bug", color: "#dc2626" },
      { key: "UI", name: "UI", color: "#aabbcc" },
    ]);
  });
});

describe("mapTask", () => {
  const columnKeys = new Set(["to-do", "done"]);

  it("maps a board task", () => {
    expect(
      mapTask(
        task({
          userId: "u1",
          assigneeName: "Ada L.",
          startDate: "2026-02-01T00:00:00.000Z",
          dueDate: "2026-02-03T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
          labels: [
            { id: "l1", name: "Bug", color: "red" },
            { id: "l2", name: "Bug", color: "red" },
          ],
        }),
        columnKeys,
        members,
      ),
    ).toEqual({
      key: "t1",
      number: 1,
      columnKey: "to-do",
      title: "Write docs",
      description: "Some **markdown**",
      priority: "high",
      startDate: "2026-02-01T00:00:00.000Z",
      dueDate: "2026-02-03T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      assignee: { name: "Ada", email: "ada@example.com" },
      labelKeys: ["Bug"],
      comments: [],
    });
  });

  it("maps planned tasks to no column and archived tasks to archived", () => {
    expect(
      mapTask(task({ status: "planned" }), columnKeys, members),
    ).toMatchObject({ columnKey: null });
    const archived = mapTask(task({ status: "archived" }), columnKeys, members);
    expect(archived.columnKey).toBeNull();
    expect(archived.archived).toBe(true);
  });

  it("leaves the number out when the source task has none", () => {
    expect(
      mapTask(task({ number: null }), columnKeys, members),
    ).not.toHaveProperty("number");
  });

  it("keeps the assignee name when the member is gone", () => {
    expect(
      mapTask(
        task({ userId: "u9", assigneeName: "Former" }),
        columnKeys,
        members,
      ).assignee,
    ).toEqual({ name: "Former" });
  });

  it("prefers a fully loaded description", () => {
    expect(
      mapTask(
        task({ description: null, descriptionDeferred: true }),
        columnKeys,
        members,
        {
          description: "Full text",
        },
      ).description,
    ).toBe("Full text");
  });
});

describe("mapComments", () => {
  it("keeps only comments, oldest first, with the right authors", () => {
    const comments = mapComments(
      [
        activity({
          id: "a3",
          userId: "u2",
          content: "Third",
          createdAt: "2026-01-03T00:00:00.000Z",
        }),
        activity({
          id: "a2",
          type: "status_changed",
          content: "moved",
          createdAt: "2026-01-02T12:00:00.000Z",
        }),
        activity({
          id: "a2b",
          externalUserName: "Trello Tom",
          content: "Second",
          createdAt: "2026-01-02T00:00:00.000Z",
        }),
        activity({ id: "a1", content: "First" }),
        activity({ id: "a0", content: "   " }),
      ],
      members,
      new Map([["a3", "Grace"]]),
    );

    expect(comments).toEqual([
      {
        author: { name: "Ada", email: "ada@example.com" },
        body: "First",
        createdAt: "2026-01-01T10:00:00.000Z",
      },
      {
        author: { name: "Trello Tom" },
        body: "Second",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
      {
        author: { name: "Grace" },
        body: "Third",
        createdAt: "2026-01-03T00:00:00.000Z",
      },
    ]);
  });

  it("keeps API order reversed for comments with the same timestamp", () => {
    const comments = mapComments(
      [
        activity({ id: "b", content: "Later" }),
        activity({ id: "a", content: "Earlier" }),
      ],
      members,
    );
    expect(comments.map((comment) => comment.body)).toEqual([
      "Earlier",
      "Later",
    ]);
  });

  it("falls back to an unknown author", () => {
    expect(
      mapComments([activity({ userId: null })], members)[0]?.author,
    ).toEqual({ name: UNKNOWN_AUTHOR });
  });
});

describe("needsAuthorNames", () => {
  it("is true only when a comment author is neither external nor a member", () => {
    expect(needsAuthorNames([activity({})], members)).toBe(false);
    expect(
      needsAuthorNames(
        [activity({ userId: "u2", externalUserName: "X" })],
        members,
      ),
    ).toBe(false);
    expect(needsAuthorNames([activity({ userId: "u2" })], members)).toBe(true);
    expect(
      needsAuthorNames(
        [activity({ userId: "u2", type: "status_changed" })],
        members,
      ),
    ).toBe(false);
  });
});

describe("mapRelations", () => {
  it("dedupes, keeps in-project links and counts the rest", () => {
    const ids = new Set(["t1", "t2", "t3"]);
    expect(
      mapRelations(
        [
          {
            id: "r1",
            sourceTaskId: "t1",
            targetTaskId: "t2",
            relationType: "subtask",
          },
          {
            id: "r1",
            sourceTaskId: "t1",
            targetTaskId: "t2",
            relationType: "subtask",
          },
          {
            id: "r2",
            sourceTaskId: "t2",
            targetTaskId: "t3",
            relationType: "blocks",
          },
          {
            id: "r3",
            sourceTaskId: "t3",
            targetTaskId: "t1",
            relationType: "related",
          },
          {
            id: "r4",
            sourceTaskId: "t1",
            targetTaskId: "x9",
            relationType: "related",
          },
          {
            id: "r4",
            sourceTaskId: "t1",
            targetTaskId: "x9",
            relationType: "related",
          },
          {
            id: "r5",
            sourceTaskId: "t1",
            targetTaskId: "t3",
            relationType: "duplicates",
          },
        ],
        ids,
      ),
    ).toEqual({
      relations: [
        { sourceKey: "t1", targetKey: "t2", type: "subtask" },
        { sourceKey: "t2", targetKey: "t3", type: "blocks" },
        { sourceKey: "t3", targetKey: "t1", type: "related" },
      ],
      outsideProject: 1,
    });
  });
});
