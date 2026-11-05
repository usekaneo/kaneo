import { describe, expect, it } from "vite-plus/test";
import { upsertWorkflowRuleBody } from "./schema";

describe("Tangled workflow rules", () => {
  it("accepts branch pushes for Tangled", () => {
    expect(
      upsertWorkflowRuleBody.safeParse({
        integrationType: "tangled",
        eventType: "branch_push",
        columnId: "column",
      }).success,
    ).toBe(true);
  });
  it.each([
    "pr_opened",
    "pr_merged",
    "issue_opened",
    "issue_closed",
    "issue_reopened",
  ])("rejects unsupported Tangled event %s", (eventType) => {
    expect(
      upsertWorkflowRuleBody.safeParse({
        integrationType: "tangled",
        eventType,
        columnId: "column",
      }).success,
    ).toBe(false);
  });
  it("keeps existing provider event validation unchanged", () => {
    expect(
      upsertWorkflowRuleBody.safeParse({
        integrationType: "github",
        eventType: "pr_merged",
        columnId: "column",
      }).success,
    ).toBe(true);
  });
});
