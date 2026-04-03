import { describe, expect, it } from "vitest";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../../../../apps/api/src/plugins/github/utils/extract-priority";

describe("extractIssuePriority", () => {
  it("returns the first valid priority label", () => {
    expect(
      extractIssuePriority([
        "type:bug",
        { name: "priority:high" },
        "priority:low",
      ]),
    ).toBe("high");
  });

  it("returns null for missing or malformed priority labels", () => {
    expect(extractIssuePriority(undefined)).toBeNull();
    expect(extractIssuePriority(["priority:critical"])).toBeNull();
    expect(extractIssuePriority([{ name: "type:feature" }])).toBeNull();
  });

  it("treats case-sensitive malformed labels as invalid", () => {
    expect(
      extractIssuePriority(["Priority:high", "priority:URGENT"]),
    ).toBeNull();
  });
});

describe("extractIssueStatus", () => {
  it("normalizes whitespace and casing", () => {
    expect(
      extractIssueStatus(["kind:feature", { name: "status:  In-Review  " }]),
    ).toBe("in-review");
  });

  it("returns null for missing labels or invalid slugs", () => {
    expect(extractIssueStatus(undefined)).toBeNull();
    expect(extractIssueStatus([{ name: "priority:high" }])).toBeNull();
    expect(extractIssueStatus(["status:Needs Review"])).toBeNull();
    expect(extractIssueStatus(["status:review!"])).toBeNull();
  });
});
