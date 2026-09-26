import { describe, expect, it } from "vitest";
import { formatIssueBody } from "../../../../../apps/api/src/plugins/github/utils/format";
import { taskDescriptionFromIssue } from "../../../../../apps/api/src/plugins/gitlab/utils/issue-description";

const taskId = "uhapfwllr062kqj36fd7k1eq";

describe("taskDescriptionFromIssue", () => {
  it("removes the footer Kaneo appended to a description", () => {
    expect(
      taskDescriptionFromIssue(formatIssueBody("Ten attempts per IP.", taskId)),
    ).toBe("Ten attempts per IP.");
  });

  it("returns an empty description when the body is only the footer", () => {
    expect(taskDescriptionFromIssue(formatIssueBody("", taskId))).toBe("");
  });

  it("keeps a multi-line description intact", () => {
    const description = "First line.\n\n- a list item\n- another";
    expect(taskDescriptionFromIssue(formatIssueBody(description, taskId))).toBe(
      description,
    );
  });

  it("leaves a description written in GitLab untouched", () => {
    expect(
      taskDescriptionFromIssue("Written by hand.\n\n---\nNo footer."),
    ).toBe("Written by hand.\n\n---\nNo footer.");
  });

  it("returns an empty string for a missing body", () => {
    expect(taskDescriptionFromIssue(null)).toBe("");
  });

  it("keeps a single footer across a GitLab edit followed by a Kaneo edit", () => {
    const written = formatIssueBody("Original.", taskId);
    const editedInGitlab = written.replace("Original.", "Edited in GitLab.");

    const taskDescription = taskDescriptionFromIssue(editedInGitlab);
    const writtenAgain = formatIssueBody(`${taskDescription} More.`, taskId);

    expect(writtenAgain.match(/<sub>Task:/g)).toHaveLength(1);
  });
});
