import { describe, expect, it } from "vite-plus/test";
import { assigneeMenuOptions } from "./assignee-menu-options";

const members = [{ id: "user-1", name: "John Doe", email: null, image: null }];

function selectedValues(current: string | null | undefined) {
  return assigneeMenuOptions(members, current, "Unassigned")
    .filter((option) => option.selected)
    .map((option) => option.value);
}

describe("assigneeMenuOptions", () => {
  it("lists unassigned first, then members", () => {
    expect(
      assigneeMenuOptions(members, null, "Unassigned").map(
        (option) => option.label,
      ),
    ).toEqual(["Unassigned", "John Doe"]);
  });

  it("marks unassigned when nobody is assigned", () => {
    expect(selectedValues(null)).toEqual([""]);
  });

  it("marks the assigned member", () => {
    expect(selectedValues("user-1")).toEqual(["user-1"]);
  });

  it("marks nothing when the selection is mixed", () => {
    expect(selectedValues(undefined)).toEqual([]);
  });
});
