import { describe, expect, it } from "vitest";
import type { KaneoClient } from "./kaneo.js";
import { migrate } from "./migrate.js";
import type { BoardBundle, PlankaClient } from "./planka.js";

type Call = { method: string; args: unknown[] };

function fakeKaneo(calls: Call[]) {
  let taskCounter = 0;
  const record = (method: string, ...args: unknown[]) => {
    calls.push({ method, args });
  };

  return {
    async listProjects() {
      record("listProjects");
      return [{ id: "p_existing", name: "Existing", slug: "MWR" }];
    },
    async listMembers() {
      record("listMembers");
      return [{ id: "ku_1", name: "Sam", email: "Sam@Example.com" }];
    },
    async createProject(input: unknown) {
      record("createProject", input);
      return { id: "p_new", name: "Board", slug: "B" };
    },
    async listColumns() {
      record("listColumns");
      return [
        { id: "c_default_1", name: "To Do", slug: "to-do" },
        { id: "c_default_2", name: "Done", slug: "done" },
      ];
    },
    async deleteColumn(id: string) {
      record("deleteColumn", id);
      return {};
    },
    async createColumn(_projectId: string, input: unknown) {
      record("createColumn", input);
      return { id: "c_new", name: "x", slug: "x" };
    },
    async createTask(_projectId: string, input: unknown) {
      record("createTask", input);
      taskCounter++;
      return { id: `t_${taskCounter}`, title: "t", number: taskCounter };
    },
    async createLabel(input: unknown) {
      record("createLabel", input);
      return { id: "l_1", name: "l", color: "#000000" };
    },
    async createTaskRelation(input: unknown) {
      record("createTaskRelation", input);
      return {};
    },
    async createComment(
      taskId: string,
      content: string,
      externalUserName?: string,
    ) {
      record("createComment", taskId, content, externalUserName);
      return {};
    },
  } as unknown as KaneoClient;
}

function fakePlanka(bundle: BoardBundle, comments: unknown[] = []) {
  return {
    async getBoard() {
      return bundle;
    },
    async listComments() {
      return {
        comments,
        users: [],
      };
    },
  } as unknown as PlankaClient;
}

const board = { id: "b1", projectId: "pr1", name: "Main", position: 0 };
const project = { id: "pr1", name: "Marketing Website Redesign" };

function bundleWith(overrides: Partial<BoardBundle["included"]>): BoardBundle {
  return {
    item: board,
    included: {
      lists: [
        {
          id: "l1",
          boardId: "b1",
          name: "Backlog",
          type: "active",
          position: 1,
          color: null,
        },
        {
          id: "l2",
          boardId: "b1",
          name: "Shipped",
          type: "closed",
          position: 2,
          color: null,
        },
        {
          id: "l3",
          boardId: "b1",
          name: "Archive",
          type: "archive",
          position: 3,
          color: null,
        },
      ],
      cards: [
        {
          id: "card1",
          boardId: "b1",
          listId: "l1",
          name: "Write copy",
          description: "Homepage",
          position: 1,
          dueDate: null,
          isDueCompleted: null,
          isClosed: null,
          commentsTotal: 0,
        },
      ],
      ...overrides,
    },
  };
}

const target = { project, board, boardCountInProject: 1 };

describe("migrate (dry run)", () => {
  it("reports counts without calling Kaneo", async () => {
    const calls: Call[] = [];
    const [report] = await migrate({
      planka: fakePlanka(bundleWith({})),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: true,
      skipComments: false,
    });

    expect(calls).toEqual([]);
    expect(report?.columns).toBe(2);
    expect(report?.tasks).toBe(1);
    expect(report?.skippedLists).toEqual(["Archive"]);
  });

  it("counts comments from the denormalized card total", async () => {
    const bundle = bundleWith({});
    const [firstCard] = bundle.included.cards ?? [];
    if (firstCard) firstCard.commentsTotal = 4;

    const [report] = await migrate({
      planka: fakePlanka(bundle),
      kaneo: fakeKaneo([]),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: true,
      skipComments: false,
    });

    expect(report?.comments).toBe(4);
  });
});

describe("migrate (write)", () => {
  it("removes Kaneo's seeded columns before creating the PLANKA ones", async () => {
    const calls: Call[] = [];
    await migrate({
      planka: fakePlanka(bundleWith({})),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    const sequence = calls.map((call) => call.method);
    const lastDelete = sequence.lastIndexOf("deleteColumn");
    const firstCreate = sequence.indexOf("createColumn");

    expect(sequence.filter((m) => m === "deleteColumn")).toHaveLength(2);
    expect(lastDelete).toBeLessThan(firstCreate);

    const created = calls
      .filter((call) => call.method === "createColumn")
      .map((call) => call.args[0]);
    expect(created).toEqual([
      { name: "Backlog", isFinal: false },
      { name: "Shipped", isFinal: true },
    ]);
  });

  it("avoids a project key that is already taken in the workspace", async () => {
    const calls: Call[] = [];
    const [report] = await migrate({
      planka: fakePlanka(bundleWith({})),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    // "Marketing Website Redesign" -> MWR, which the fake workspace already has.
    expect(report?.projectKey).toBe("MWR-2");
  });

  it("attaches labels via createLabel so existing labels are never moved", async () => {
    const calls: Call[] = [];
    await migrate({
      planka: fakePlanka(
        bundleWith({
          labels: [
            {
              id: "lab1",
              boardId: "b1",
              name: "Urgent",
              color: "berry-red",
              position: 1,
            },
          ],
          cardLabels: [{ cardId: "card1", labelId: "lab1" }],
        }),
      ),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    const labelCalls = calls
      .filter((call) => call.method === "createLabel")
      .map((call) => call.args[0]);

    expect(labelCalls).toEqual([
      { name: "Urgent", color: "#e83855", workspaceId: "ws_1" },
      { name: "Urgent", color: "#e83855", workspaceId: "ws_1", taskId: "t_1" },
    ]);
  });

  it("resolves an assignee by email, case-insensitively", async () => {
    const calls: Call[] = [];
    const [report] = await migrate({
      planka: fakePlanka(
        bundleWith({
          cardMemberships: [{ cardId: "card1", userId: "pu1" }],
          users: [
            {
              id: "pu1",
              email: "sam@example.com",
              name: "Sam",
              username: null,
            },
          ],
        }),
      ),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    const task = calls.find((call) => call.method === "createTask")
      ?.args[0] as { userId?: string };
    expect(task.userId).toBe("ku_1");
    expect(report?.assignees).toBe(1);
  });

  it("leaves the task unassigned when the member is not in the workspace", async () => {
    const calls: Call[] = [];
    await migrate({
      planka: fakePlanka(
        bundleWith({
          cardMemberships: [{ cardId: "card1", userId: "pu9" }],
          users: [
            {
              id: "pu9",
              email: "nobody@example.com",
              name: "Nobody",
              username: null,
            },
          ],
        }),
      ),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    const task = calls.find((call) => call.method === "createTask")
      ?.args[0] as { userId?: string };
    expect(task.userId).toBeUndefined();
  });

  it("skips cards that live in archive or trash lists", async () => {
    const calls: Call[] = [];
    const bundle = bundleWith({});
    bundle.included.cards?.push({
      id: "card2",
      boardId: "b1",
      listId: "l3",
      name: "Old card",
      description: null,
      position: 1,
      dueDate: null,
      isDueCompleted: null,
      isClosed: null,
      commentsTotal: 0,
    });

    await migrate({
      planka: fakePlanka(bundle),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    const titles = calls
      .filter((call) => call.method === "createTask")
      .map((call) => (call.args[0] as { title: string }).title);
    expect(titles).toEqual(["Write copy"]);
  });

  it("does not fetch comments when the card reports none", async () => {
    const calls: Call[] = [];
    await migrate({
      planka: fakePlanka(bundleWith({}), [
        {
          id: "cm1",
          cardId: "card1",
          userId: null,
          text: "hi",
          createdAt: null,
        },
      ]),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    expect(calls.some((call) => call.method === "createComment")).toBe(false);
  });

  it("isolates a failing board instead of aborting the whole run", async () => {
    const failing = {
      async getBoard() {
        throw new Error("boom");
      },
      async listComments() {
        return { comments: [], users: [] };
      },
    } as unknown as PlankaClient;

    const reports = await migrate({
      planka: failing,
      kaneo: fakeKaneo([]),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    expect(reports[0]?.failed).toBe(true);
    expect(reports[0]?.error).toBe("boom");
  });

  it("warns when PLANKA hid the assignee email instead of failing silently", async () => {
    const calls: Call[] = [];
    const [report] = await migrate({
      planka: fakePlanka(
        bundleWith({
          cardMemberships: [{ cardId: "card1", userId: "pu1" }],
          users: [{ id: "pu1", email: null, name: "Hidden", username: null }],
        }),
      ),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    expect(report?.assignees).toBe(0);
    expect(report?.warnings.join(" ")).toContain("PLANKA admin account");
  });

  it("warns when the assignee is not in the target workspace", async () => {
    const calls: Call[] = [];
    const [report] = await migrate({
      planka: fakePlanka(
        bundleWith({
          cardMemberships: [{ cardId: "card1", userId: "pu9" }],
          users: [
            {
              id: "pu9",
              email: "outsider@example.com",
              name: "Outsider",
              username: null,
            },
          ],
        }),
      ),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    expect(report?.warnings.join(" ")).toContain("Invite those people");
  });

  it("turns a linked checklist item into a task relation, not checkbox text", async () => {
    const calls: Call[] = [];
    const bundle = bundleWith({
      taskLists: [{ id: "tl1", cardId: "card1", name: "Depends on" }],
      tasks: [
        {
          id: "t1",
          taskListId: "tl1",
          name: "Blocked by card 2",
          isCompleted: false,
          position: 1,
          linkedCardId: "card2",
        },
      ],
    });
    bundle.included.cards?.push({
      id: "card2",
      boardId: "b1",
      listId: "l1",
      name: "The dependency",
      description: null,
      position: 2,
      dueDate: null,
      isDueCompleted: null,
      isClosed: null,
      commentsTotal: 0,
    });

    const [report] = await migrate({
      planka: fakePlanka(bundle),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    const relations = calls
      .filter((call) => call.method === "createTaskRelation")
      .map((call) => call.args[0]);
    expect(relations).toEqual([
      { sourceTaskId: "t_1", targetTaskId: "t_2", relationType: "subtask" },
    ]);
    expect(report?.relations).toBe(1);

    const descriptions = calls
      .filter((call) => call.method === "createTask")
      .map((call) => (call.args[0] as { description: string }).description);
    expect(descriptions.join(" ")).not.toContain("Blocked by card 2");
  });

  it("attributes imported comments to the original PLANKA author", async () => {
    const calls: Call[] = [];
    const bundle = bundleWith({
      users: [{ id: "pu1", email: null, name: "Sam", username: null }],
    });
    const [firstCard] = bundle.included.cards ?? [];
    if (firstCard) firstCard.commentsTotal = 1;

    await migrate({
      planka: fakePlanka(bundle, [
        {
          id: "cm1",
          cardId: "card1",
          userId: "pu1",
          text: "Looks good",
          createdAt: "2026-03-04T10:00:00.000Z",
        },
      ]),
      kaneo: fakeKaneo(calls),
      workspaceId: "ws_1",
      targets: [target],
      dryRun: false,
      skipComments: false,
    });

    const comment = calls.find((call) => call.method === "createComment");
    expect(comment?.args[2]).toBe("Sam");
  });
});
