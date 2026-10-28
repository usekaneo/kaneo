import { describe, expect, it } from "vite-plus/test";
import { findTaskGroup, moveTarget, stepFocus } from "./task-groups";

const groups = [
  { id: "todo", taskIds: ["a", "b", "c"] },
  { id: "doing", taskIds: [] },
  { id: "review", taskIds: ["d"] },
  { id: "done", taskIds: ["e", "f"], collapsed: true },
];

describe("findTaskGroup", () => {
  it("returns the group and index of a task", () => {
    expect(findTaskGroup(groups, "d")).toMatchObject({
      group: { id: "review" },
      groupIndex: 2,
      index: 0,
    });
    expect(findTaskGroup(groups, "missing")).toBeNull();
    expect(findTaskGroup(groups, null)).toBeNull();
  });
});

describe("stepFocus in a list", () => {
  it("walks visible tasks across groups and stops at the ends", () => {
    expect(stepFocus(groups, "list", "c", "down")).toBe("d");
    expect(stepFocus(groups, "list", "d", "down")).toBe("d");
    expect(stepFocus(groups, "list", "a", "up")).toBe("a");
    expect(stepFocus(groups, "list", "d", "up")).toBe("c");
  });

  it("starts at the first or last task without focus", () => {
    expect(stepFocus(groups, "list", null, "down")).toBe("a");
    expect(stepFocus(groups, "list", null, "up")).toBe("d");
    expect(stepFocus(groups, "list", "e", "down")).toBe("a");
  });

  it("ignores left and right", () => {
    expect(stepFocus(groups, "list", "a", "right")).toBeNull();
  });
});

describe("stepFocus on a board", () => {
  it("moves within a column", () => {
    expect(stepFocus(groups, "board", "a", "down")).toBe("b");
    expect(stepFocus(groups, "board", "c", "down")).toBe("c");
    expect(stepFocus(groups, "board", "a", "up")).toBe("a");
  });

  it("jumps to the nearest row of the next column with tasks", () => {
    expect(stepFocus(groups, "board", "c", "right")).toBe("d");
    expect(stepFocus(groups, "board", "d", "left")).toBe("a");
    expect(stepFocus(groups, "board", "d", "right")).toBe("d");
  });
});

describe("moveTarget", () => {
  it("targets the neighbouring task within a group", () => {
    expect(moveTarget(groups, "list", "b", "up")).toBe("a");
    expect(moveTarget(groups, "list", "b", "down")).toBe("c");
    expect(moveTarget(groups, "list", "c", "top")).toBe("a");
    expect(moveTarget(groups, "list", "a", "bottom")).toBe("c");
  });

  it("does nothing at the edge of a group", () => {
    expect(moveTarget(groups, "list", "a", "up")).toBeNull();
    expect(moveTarget(groups, "list", "a", "top")).toBeNull();
    expect(moveTarget(groups, "list", "c", "down")).toBeNull();
    expect(moveTarget(groups, "list", "d", "bottom")).toBeNull();
  });

  it("targets the adjacent column on a board only", () => {
    expect(moveTarget(groups, "board", "a", "right")).toBe("doing");
    expect(moveTarget(groups, "board", "d", "left")).toBe("doing");
    expect(moveTarget(groups, "board", "a", "left")).toBeNull();
    expect(moveTarget(groups, "list", "a", "right")).toBeNull();
  });
});
