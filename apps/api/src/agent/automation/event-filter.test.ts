import { describe, expect, it } from "vite-plus/test";
import { matchesAutomationFilters } from "./event-filter";

const facts = {
  projectId: "p1",
  columnName: "In review",
  labelNames: ["Bug", "Backend"],
};
const none = { labelName: null, columnName: null, projectId: null };

describe("matchesAutomationFilters", () => {
  it("matches everything without filters", () => {
    expect(matchesAutomationFilters(none, facts)).toBe(true);
  });

  it("matches labels and columns by name, ignoring case and spacing", () => {
    expect(
      matchesAutomationFilters({ ...none, labelName: " bug " }, facts),
    ).toBe(true);
    expect(
      matchesAutomationFilters({ ...none, columnName: "in review" }, facts),
    ).toBe(true);
    expect(
      matchesAutomationFilters({ ...none, labelName: "Feature" }, facts),
    ).toBe(false);
    expect(
      matchesAutomationFilters({ ...none, columnName: "Done" }, facts),
    ).toBe(false);
  });

  it("requires every filter to match", () => {
    expect(
      matchesAutomationFilters(
        { labelName: "Bug", columnName: "In review", projectId: "p2" },
        facts,
      ),
    ).toBe(false);
    expect(
      matchesAutomationFilters(
        { labelName: "Bug", columnName: "In review", projectId: "p1" },
        facts,
      ),
    ).toBe(true);
  });

  it("does not match a column filter for tasks without a column", () => {
    expect(
      matchesAutomationFilters(
        { ...none, columnName: "In review" },
        { ...facts, columnName: null },
      ),
    ).toBe(false);
  });
});
