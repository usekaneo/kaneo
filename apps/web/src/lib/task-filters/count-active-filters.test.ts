import { expect, it } from "vite-plus/test";
import { countActiveFilters } from "./count-active-filters";

it("counts each filtered subject once", () => {
  expect(
    countActiveFilters({
      status: ["todo", "done"],
      priority: null,
      assignee: [],
      dueDate: ["noDueDate"],
      labels: null,
      customFields: { size: ["L"], team: [] },
    }),
  ).toBe(3);
});
