import { describe, expect, it } from "vitest";
import { extractIssueReferences } from "../../../../../apps/api/src/plugins/github/utils/issue-references";

const repository = "https://github.com/acme/repo";

describe("extractIssueReferences", () => {
  it.each([
    "close",
    "closes",
    "closed",
    "fix",
    "fixes",
    "fixed",
    "resolve",
    "resolves",
    "resolved",
    "CLOSES:",
  ])("recognizes %s as a remote issue reference", (keyword) => {
    expect(
      extractIssueReferences("Change", `${keyword} #61`, repository),
    ).toEqual(["61"]);
  });

  it.each([
    "Closes acme/repo#61",
    "Closes ACME/REPO#61",
    "Closes https://github.com/acme/repo/issues/61",
    "Closes https://github.com/acme/repo/issues/61.",
  ])("resolves same-repository reference %s", (body) => {
    expect(extractIssueReferences("Change", body, repository)).toEqual(["61"]);
  });

  it.each([
    "Closes other/repo#61",
    "Closes acme/other#61",
    "Closes https://example.com/acme/repo/issues/61",
    "Closes https://github.com/acme/other/issues/61",
    "Closes https://github.com/acme/repo/pull/61",
    "Closes #61extra",
    "Closes 61",
    "Mention #61",
    "Discloses #61",
  ])("ignores %s", (body) => {
    expect(extractIssueReferences("Change", body, repository)).toEqual([]);
  });

  it("deduplicates title and repeated body references", () => {
    expect(
      extractIssueReferences(
        "Fix sidebar (#61)",
        "Closes #61, resolves #88, fixes #61",
        repository,
      ),
    ).toEqual(["61", "88"]);
  });

  it("keeps qualified title references scoped to their repository", () => {
    expect(
      extractIssueReferences("Fix other/repo#61", null, repository),
    ).toEqual([]);
  });

  it("supports a Gitea instance hosted below a path", () => {
    expect(
      extractIssueReferences(
        "Change",
        "Closes https://git.example.com/gitea/acme/repo/issues/61",
        "https://git.example.com/gitea/acme/repo",
      ),
    ).toEqual(["61"]);
    expect(
      extractIssueReferences(
        "Change",
        "Closes https://git.example.com/acme/repo/issues/61",
        "https://git.example.com/gitea/acme/repo",
      ),
    ).toEqual([]);
  });
});
