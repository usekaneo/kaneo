import { describe, expect, it } from "vitest";
import {
  extractClosedIssueNumbers,
  extractClosedIssueNumbersFromCommits,
} from "../../../../../apps/api/src/plugins/github/utils/parse-close-keywords";

describe("extractClosedIssueNumbers", () => {
  it("matches each GitHub closing keyword", () => {
    for (const keyword of [
      "close",
      "closes",
      "closed",
      "fix",
      "fixes",
      "fixed",
      "resolve",
      "resolves",
      "resolved",
    ]) {
      expect(extractClosedIssueNumbers(`${keyword} #7`)).toEqual([7]);
    }
  });

  it("is case-insensitive and allows a colon separator", () => {
    expect(extractClosedIssueNumbers("Fixes #12")).toEqual([12]);
    expect(extractClosedIssueNumbers("closes: #34")).toEqual([34]);
  });

  it("extracts multiple unique references in first-seen order", () => {
    expect(
      extractClosedIssueNumbers("closes #3, fixes #4 and closes #3"),
    ).toEqual([3, 4]);
  });

  it("ignores a bare reference without a closing keyword", () => {
    expect(extractClosedIssueNumbers("see #9 for context")).toEqual([]);
    expect(extractClosedIssueNumbers("refs #9")).toEqual([]);
  });

  it("does not match a keyword glued to other letters", () => {
    expect(extractClosedIssueNumbers("prefixes #9")).toEqual([]);
    expect(extractClosedIssueNumbers("closely #9")).toEqual([]);
  });

  it("handles empty input", () => {
    expect(extractClosedIssueNumbers("")).toEqual([]);
  });
});

describe("extractClosedIssueNumbersFromCommits", () => {
  it("collects unique references across commits", () => {
    const numbers = extractClosedIssueNumbersFromCommits([
      { message: "feat: thing\n\ncloses #1" },
      { message: "fix: other (fixes #2)" },
      { message: "chore: noop" },
      { message: "docs: again closes #1" },
      { message: null },
    ]);
    expect(numbers).toEqual([1, 2]);
  });
});
