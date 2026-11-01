import { describe, expect, it } from "vite-plus/test";
import {
  getAssigneeFilterKeys,
  getTaskAssigneeIds,
  MAX_ASSIGNEES,
  sameAssigneeSet,
  splitVisibleAssignees,
  toggleAssignee,
} from "./task-assignees";

describe("task assignee helpers", () => {
  it("falls back to the primary assignee for older responses", () => {
    expect(getTaskAssigneeIds({ userId: "a" })).toEqual(["a"]);
    expect(getTaskAssigneeIds({ userId: null })).toEqual([]);
    expect(
      getTaskAssigneeIds({ userId: "a", assigneeIds: ["a", "b"] }),
    ).toEqual(["a", "b"]);
  });

  it("filters unassigned tasks under the empty key", () => {
    expect(getAssigneeFilterKeys({ userId: null })).toEqual([""]);
    expect(
      getAssigneeFilterKeys({ userId: "a", assigneeIds: ["a", "b"] }),
    ).toEqual(["a", "b"]);
  });

  it("toggles people and clears with the unassigned option", () => {
    expect(toggleAssignee(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleAssignee(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleAssignee(["a", "b"], "")).toEqual([]);
  });

  it("stops adding at the assignee limit", () => {
    const full = Array.from({ length: MAX_ASSIGNEES }, (_, i) => `u${i}`);
    expect(toggleAssignee(full, "extra")).toEqual(full);
  });

  it("compares sets regardless of order", () => {
    expect(sameAssigneeSet(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameAssigneeSet(["a"], ["a", "b"])).toBe(false);
  });

  it("folds extra avatars into a +N chip that never hides a single person", () => {
    expect(splitVisibleAssignees(["a", "b", "c"])).toEqual({
      shown: ["a", "b", "c"],
      overflow: 0,
    });
    expect(splitVisibleAssignees(["a", "b", "c", "d"])).toEqual({
      shown: ["a", "b"],
      overflow: 2,
    });
  });
});
