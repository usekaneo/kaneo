import { describe, expect, it } from "vite-plus/test";
import type { BoardFilters } from "@/hooks/use-task-filters";
import {
  quickFilterSelection,
  toggleQuickFilterAssignee,
} from "./quick-filter-selection";

const empty: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
  customFields: null,
  project: null,
  negated: null,
};

describe("assignee quick filter selection", () => {
  it("toggles people on and off", () => {
    const one = toggleQuickFilterAssignee(empty, "u1");
    expect(one.assignee).toEqual(["u1"]);
    expect(quickFilterSelection(one)).toEqual(["u1"]);
    expect(toggleQuickFilterAssignee(one, "u1").assignee).toBeNull();
  });

  it("shows nobody pressed under an is-not filter and starts over on click", () => {
    const excluding = { ...empty, assignee: ["u1"], negated: ["assignee"] };
    expect(quickFilterSelection(excluding)).toEqual([]);
    const next = toggleQuickFilterAssignee(excluding, "u2");
    expect(next.assignee).toEqual(["u2"]);
    expect(next.negated).toBeNull();
  });

  it("keeps other negated subjects", () => {
    const next = toggleQuickFilterAssignee(
      { ...empty, labels: ["l1"], negated: ["labels"] },
      "u1",
    );
    expect(next.negated).toEqual(["labels"]);
  });
});
