import { describe, expect, it } from "vite-plus/test";
import type {
  RelatedTask,
  TaskRelationWithTasks,
} from "../api/task-relations.js";
import { groupRelations, relationsBetween } from "./group-relations.js";

const task = (id: string, number: number, done = false): RelatedTask => ({
  id,
  title: `Task ${id}`,
  status: done ? "done" : "to-do",
  isCompleted: done,
  number,
  projectId: "p1",
});

const tasks = {
  me: task("me", 3),
  parent: task("parent", 1),
  child1: task("child1", 10),
  child2: task("child2", 4, true),
  blocker: task("blocker", 7),
  blocked: task("blocked", 8),
  related: task("related", 9),
};

let next = 0;
const relation = (
  source: RelatedTask,
  target: RelatedTask,
  relationType: string,
): TaskRelationWithTasks => ({
  id: `r${++next}`,
  sourceTaskId: source.id,
  targetTaskId: target.id,
  relationType,
  sourceTask: source,
  targetTask: target,
});

const context = {
  projectSlugs: new Map([["p1", "kan"]]),
  workspaceId: "w1",
  webUrl: "https://kaneo.test",
};

const all = [
  relation(tasks.related, tasks.me, "related"),
  relation(tasks.me, tasks.child1, "subtask"),
  relation(tasks.blocker, tasks.me, "blocks"),
  relation(tasks.parent, tasks.me, "subtask"),
  relation(tasks.me, tasks.blocked, "blocks"),
  relation(tasks.me, tasks.child2, "subtask"),
];

describe("groupRelations", () => {
  it("splits the parent, subtasks and other relations", () => {
    const grouped = groupRelations(all, "me", context);
    expect(grouped.parent).toEqual({
      id: "parent",
      ticketId: "KAN-1",
      title: "Task parent",
      status: "to-do",
      completed: false,
      url: "https://kaneo.test/dashboard/workspace/w1/project/p1/task/parent",
    });
    expect(grouped.subtasks.map((item) => item.ticketId)).toEqual([
      "KAN-4",
      "KAN-10",
    ]);
    expect(
      grouped.relations.map((item) => [
        item.type,
        item.direction,
        item.task.ticketId,
      ]),
    ).toEqual([
      ["blocks", "outgoing", "KAN-8"],
      ["blocked-by", "incoming", "KAN-7"],
      ["relates-to", "incoming", "KAN-9"],
    ]);
  });

  it("keeps extra parents as subtask-of relations", () => {
    const second = task("second", 2);
    const grouped = groupRelations(
      [
        relation(tasks.parent, tasks.me, "subtask"),
        relation(second, tasks.me, "subtask"),
      ],
      "me",
      context,
    );
    expect(grouped.parent?.id).toBe("parent");
    expect(grouped.relations).toEqual([
      expect.objectContaining({ type: "subtask-of", direction: "incoming" }),
    ]);
  });

  it("leaves the ticket id null for unknown projects", () => {
    const grouped = groupRelations(
      [relation(tasks.me, { ...tasks.related, projectId: "p2" }, "related")],
      "me",
      context,
    );
    expect(grouped.relations[0]?.task.ticketId).toBeNull();
  });

  it("is empty without relations", () => {
    expect(groupRelations([], "me", context)).toEqual({
      parent: null,
      subtasks: [],
      relations: [],
    });
  });
});

describe("relationsBetween", () => {
  const pair = [
    relation(tasks.me, tasks.blocked, "blocks"),
    relation(tasks.blocked, tasks.me, "related"),
    relation(tasks.me, tasks.related, "related"),
  ];

  it("finds every relation between two tasks in either direction", () => {
    expect(relationsBetween(pair, "me", "blocked", undefined)).toHaveLength(2);
  });

  it("narrows to one type from the first task's side", () => {
    expect(
      relationsBetween(pair, "me", "blocked", "blocks").map(
        (item) => item.relationType,
      ),
    ).toEqual(["blocks"]);
    expect(relationsBetween(pair, "me", "blocked", "blocked-by")).toEqual([]);
  });
});
