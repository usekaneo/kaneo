import { describe, expect, it } from "vite-plus/test";
import {
  countActiveFilters,
  parseGlobalBoardFilters,
  setFilterNegated,
  toggleFilterValue,
  toggleLabel,
} from "./global-board-filters";

describe("parseGlobalBoardFilters", () => {
  it("keeps known filters as lists and drops junk", () => {
    expect(
      parseGlobalBoardFilters({
        label: "animacja",
        priority: ["high", "critical", "high"],
        dueDate: ["someday"],
        projectId: ["", "p1"],
        negate: ["label", "dueDate", "bogus"],
        q: "  ",
        other: "x",
      }),
    ).toEqual({
      label: ["animacja"],
      priority: ["high"],
      projectId: ["p1"],
      negate: ["label"],
    });
  });
});

describe("filter updates", () => {
  it("drops a filter's negation when its last value goes", () => {
    let filters = toggleFilterValue({}, "assigneeId", "me");
    filters = setFilterNegated(filters, "assigneeId", true);
    expect(filters).toEqual({ assigneeId: ["me"], negate: ["assigneeId"] });
    expect(toggleFilterValue(filters, "assigneeId", "me")).toEqual({});
  });

  it("matches labels by name regardless of case", () => {
    const filters = toggleLabel({ label: ["Animacja"] }, "pc-oldschool");
    expect(filters.label).toEqual(["Animacja", "pc-oldschool"]);
    expect(toggleLabel(filters, "ANIMACJA").label).toEqual(["pc-oldschool"]);
    expect(countActiveFilters({ ...filters, q: "x" })).toBe(1);
  });
});
