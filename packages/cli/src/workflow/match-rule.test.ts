import { describe, expect, it } from "vite-plus/test";
import { matchRule } from "./match-rule.js";
import type { RuleJson } from "./rule-json.js";

function rule(id: string, integration: string, event: string): RuleJson {
  return {
    id,
    integration,
    event,
    column: { id: "col_done", name: "Done", slug: "done" },
  };
}

const githubMerged = rule("r1", "github", "pr_merged");
const gitlabMerged = rule("r2", "gitlab", "pr_merged");
const githubPush = rule("r3", "github", "branch_push");
const rules = [githubMerged, gitlabMerged, githubPush];

describe("matchRule", () => {
  it("finds a rule by id", () => {
    expect(matchRule(rules, { id: "r2" })).toEqual({
      kind: "found",
      rule: gitlabMerged,
    });
  });

  it("finds the only rule for an event", () => {
    expect(matchRule(rules, { event: "branch_push" })).toEqual({
      kind: "found",
      rule: githubPush,
    });
  });

  it("asks for the integration when an event has several rules", () => {
    expect(matchRule(rules, { event: "pr_merged" })).toEqual({
      kind: "ambiguous",
      rules: [githubMerged, gitlabMerged],
    });
    expect(
      matchRule(rules, { event: "pr_merged", integration: "gitlab" }),
    ).toEqual({ kind: "found", rule: gitlabMerged });
  });

  it("reports when nothing matches", () => {
    expect(matchRule(rules, { event: "issue_closed" })).toEqual({
      kind: "none",
    });
    expect(matchRule(rules, { id: "nope" })).toEqual({ kind: "none" });
  });
});
