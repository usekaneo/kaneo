import { describe, expect, it } from "vite-plus/test";
import { planRuleChange } from "@/components/project/automations/plan-rule-change";

const rules = [
  {
    id: "rule-1",
    integrationType: "github",
    eventType: "pr_merged",
    columnId: "done",
  },
];

describe("planRuleChange", () => {
  it("clears an existing rule when the task should not move", () => {
    expect(planRuleChange(rules, "github", "pr_merged", null)).toEqual({
      type: "delete",
      id: "rule-1",
    });
  });

  it("does nothing when there is no rule to clear", () => {
    expect(planRuleChange(rules, "gitea", "pr_merged", null)).toEqual({
      type: "none",
    });
  });

  it("saves a new or changed target column", () => {
    expect(planRuleChange(rules, "github", "pr_merged", "review")).toEqual({
      type: "upsert",
      columnId: "review",
    });
    expect(planRuleChange(rules, "github", "pr_merged", "done")).toEqual({
      type: "none",
    });
  });
});
