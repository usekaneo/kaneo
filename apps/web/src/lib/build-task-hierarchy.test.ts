import { describe, expect, it } from "vitest";
import {
  buildChildrenMap,
  buildParentMap,
  flattenTree,
  getRootTaskIds,
  groupNestedByColumn,
} from "@/lib/build-task-hierarchy";
import type Task from "@/types/task";

function createTask(
  overrides: Partial<Task> & Pick<Task, "id" | "title">,
): Task {
  return {
    number: 1,
    description: null,
    status: "to-do",
    priority: null,
    startDate: null,
    dueDate: null,
    position: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
    parentId: null,
    directSubtaskCount: 0,
    completedSubtaskCount: 0,
    ...overrides,
  };
}

const sort = { field: "position" as const, direction: "asc" as const };

describe("build-task-hierarchy", () => {
  it("builds parent and children maps", () => {
    const tasks = [
      createTask({ id: "a", title: "A", parentId: null }),
      createTask({ id: "b", title: "B", parentId: "a" }),
      createTask({ id: "c", title: "C", parentId: "b" }),
    ];

    const parentMap = buildParentMap(tasks);
    const childrenMap = buildChildrenMap(tasks, parentMap);

    expect(parentMap.get("b")).toBe("a");
    expect(parentMap.get("c")).toBe("b");
    expect(childrenMap.get("a")).toEqual(["b"]);
    expect(childrenMap.get("b")).toEqual(["c"]);
  });

  it("flattens a three-level tree when expanded", () => {
    const tasks = [
      createTask({
        id: "a",
        title: "A",
        parentId: null,
        directSubtaskCount: 1,
      }),
      createTask({ id: "b", title: "B", parentId: "a", directSubtaskCount: 1 }),
      createTask({ id: "c", title: "C", parentId: "b" }),
      createTask({ id: "d", title: "D", parentId: null }),
    ];

    const nodes = flattenTree(tasks, new Set(["a", "b"]), sort);

    expect(nodes.map((node) => node.id)).toEqual(["a", "b", "c", "d"]);
    expect(nodes.map((node) => node.depth)).toEqual([0, 1, 2, 0]);
  });

  it("treats filtered-out parents as roots", () => {
    const tasks = [
      createTask({ id: "child", title: "Child", parentId: "missing-parent" }),
    ];

    expect(getRootTaskIds(tasks, buildParentMap(tasks))).toEqual(["child"]);
  });

  it("groups nested tasks within columns and marks cross-column parents", () => {
    const columns = [
      {
        id: "to-do",
        tasks: [
          createTask({
            id: "parent",
            title: "Parent",
            status: "to-do",
            parentId: null,
            directSubtaskCount: 1,
          }),
          createTask({
            id: "child-same",
            title: "Child same",
            status: "to-do",
            parentId: "parent",
          }),
        ],
      },
      {
        id: "in-progress",
        tasks: [
          createTask({
            id: "child-cross",
            title: "Child cross",
            status: "in-progress",
            parentId: "parent",
          }),
        ],
      },
    ];

    const grouped = groupNestedByColumn(columns, new Set(["parent"]), sort);
    const todoNodes = grouped[0].tasks;
    const progressNodes = grouped[1].tasks;

    expect(todoNodes.map((node) => node.id)).toEqual(["parent", "child-same"]);
    expect(todoNodes[1].parentInSameColumn).toBe(true);

    expect(progressNodes.map((node) => node.id)).toEqual(["child-cross"]);
    expect(progressNodes[0].parentInSameColumn).toBe(false);
    expect(progressNodes[0].parentTitle).toBe("Parent");
  });
});
