import { describe, expect, it } from "vitest";
import type Task from "@/types/task";
import { buildTaskHierarchy } from "./build-task-hierarchy";

const task = (id: string): Task => ({
  id,
  title: id,
  number: null,
  description: null,
  status: "to-do",
  priority: null,
  startDate: null,
  dueDate: null,
  position: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
});

describe("buildTaskHierarchy", () => {
  it("builds nested task trees and omits unrelated tasks", () => {
    const result = buildTaskHierarchy(
      [task("parent"), task("child"), task("grandchild"), task("unrelated")],
      [
        { sourceTaskId: "parent", targetTaskId: "child" },
        { sourceTaskId: "child", targetTaskId: "grandchild" },
      ],
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.task.id).toBe("parent");
    expect(result[0]?.children[0]?.task.id).toBe("child");
    expect(result[0]?.children[0]?.children[0]?.task.id).toBe("grandchild");
  });

  it("does not recurse forever when legacy relations contain a cycle", () => {
    const result = buildTaskHierarchy(
      [task("one"), task("two")],
      [
        { sourceTaskId: "one", targetTaskId: "two" },
        { sourceTaskId: "two", targetTaskId: "one" },
      ],
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.children).toHaveLength(1);
    expect(result[0]?.children[0]?.children).toHaveLength(0);
  });

  it("keeps a matching child visible when its parent is filtered out", () => {
    const result = buildTaskHierarchy(
      [task("child")],
      [{ sourceTaskId: "filtered-parent", targetTaskId: "child" }],
    );

    expect(result.map((node) => node.task.id)).toEqual(["child"]);
  });

  it("uses the supplied task order for roots and children", () => {
    const result = buildTaskHierarchy(
      [task("parent"), task("second"), task("first")],
      [
        { sourceTaskId: "parent", targetTaskId: "first" },
        { sourceTaskId: "parent", targetTaskId: "second" },
      ],
    );

    expect(result[0]?.children.map((node) => node.task.id)).toEqual([
      "second",
      "first",
    ]);
  });

  it("includes standalone tasks when requested", () => {
    const result = buildTaskHierarchy(
      [task("parent"), task("child"), task("standalone")],
      [{ sourceTaskId: "parent", targetTaskId: "child" }],
      { includeUnrelated: true },
    );

    expect(result.map((node) => node.task.id)).toEqual([
      "parent",
      "standalone",
    ]);
  });
});
