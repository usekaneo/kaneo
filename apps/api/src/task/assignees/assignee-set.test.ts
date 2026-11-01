import { describe, expect, it } from "vite-plus/test";
import {
  diffAssigneeIds,
  normalizeAssigneeIds,
  pickPrimaryAssignee,
  resolveRequestedAssignees,
} from "./assignee-set";

describe("assignee set rules", () => {
  it("trims, drops blanks and de-duplicates in order", () => {
    expect(
      normalizeAssigneeIds([" a ", "", null, "b", "a", undefined]),
    ).toEqual(["a", "b"]);
  });

  it("keeps the current primary while it is still assigned", () => {
    expect(pickPrimaryAssignee("b", ["a", "b"])).toBe("b");
    expect(pickPrimaryAssignee("c", ["a", "b"])).toBe("a");
    expect(pickPrimaryAssignee(null, ["x"])).toBe("x");
    expect(pickPrimaryAssignee("a", [])).toBeNull();
  });

  it("reports only the added and removed people", () => {
    expect(diffAssigneeIds(["a", "b"], ["b", "c"])).toEqual({
      added: ["c"],
      removed: ["a"],
    });
  });

  it("treats assigneeIds as authoritative", () => {
    expect(
      resolveRequestedAssignees(
        { assigneeIds: ["b", "b", "c"], userId: "a" },
        { primary: "a", ids: ["a"] },
      ),
    ).toEqual(["b", "c"]);
    expect(
      resolveRequestedAssignees(
        { assigneeIds: [] },
        { primary: "a", ids: ["a"] },
      ),
    ).toEqual([]);
  });

  it("does not let a legacy client echoing the primary drop the others", () => {
    const current = { primary: "a", ids: ["a", "b"] };
    expect(resolveRequestedAssignees({ userId: "a" }, current)).toEqual([
      "a",
      "b",
    ]);
    expect(resolveRequestedAssignees({ userId: "c" }, current)).toEqual(["c"]);
    expect(resolveRequestedAssignees({}, current)).toEqual([]);
    expect(resolveRequestedAssignees({ userId: null }, current)).toEqual([]);
  });

  it("treats the first assignee as the primary when the stored one is missing", () => {
    const current = { primary: null, ids: ["b", "c"] };
    expect(resolveRequestedAssignees({ userId: "b" }, current)).toEqual([
      "b",
      "c",
    ]);
    expect(resolveRequestedAssignees({ userId: "c" }, current)).toEqual(["c"]);
  });
});
