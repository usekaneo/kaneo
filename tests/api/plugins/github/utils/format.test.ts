import { describe, expect, it } from "vitest";
import {
  formatIssueBody,
  formatIssueTitle,
  formatSyncComment,
  formatTaskDescriptionFromIssue,
  getLabelsForIssue,
} from "../../../../../apps/api/src/plugins/github/utils/format";

describe("github format helpers", () => {
  it("returns the title unchanged", () => {
    expect(formatIssueTitle("Ship notifications")).toBe("Ship notifications");
  });

  it("formats issue bodies with and without a description", () => {
    expect(formatIssueBody(null, "task_123")).toBe("<sub>Task: task_123</sub>");
    expect(formatIssueBody("Body text", "task_123")).toBe(`Body text

---
<sub>Task: task_123</sub>`);
  });

  it("formats sync comments and task descriptions", () => {
    expect(formatSyncComment("task_123")).toBe("Task: task_123");
    expect(formatTaskDescriptionFromIssue("Issue body")).toBe("Issue body");
    expect(formatTaskDescriptionFromIssue(null)).toBe("");
  });

  it.each([
    "",
    "A description",
    "  whitespace around text  ",
    "Details\n\n---\nA manual separator",
  ])(
    "round trips generated footers without changing description content: %s",
    (description) => {
      expect(
        formatTaskDescriptionFromIssue(
          formatIssueBody(description, "task_123"),
          "task_123",
        ),
      ).toBe(description);
    },
  );

  it("preserves arbitrary imports and Task mentions inside a description", () => {
    const body = "Text\n\n---\n<sub>Task: task_123</sub>\nMore text";
    expect(formatTaskDescriptionFromIssue(body, "task_123")).toBe(body);
    expect(
      formatTaskDescriptionFromIssue(formatIssueBody("Imported", "task_123")),
    ).toBe(formatIssueBody("Imported", "task_123"));
  });

  it("builds labels while skipping no-priority", () => {
    expect(getLabelsForIssue("high", "in-review")).toEqual([
      "priority:high",
      "status:in-review",
    ]);
    expect(getLabelsForIssue("no-priority", "done")).toEqual(["status:done"]);
    expect(getLabelsForIssue(null, "planned")).toEqual(["status:planned"]);
  });
});
