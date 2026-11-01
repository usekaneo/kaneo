import type { TFunction } from "i18next";
import { describe, expect, it } from "vite-plus/test";
import { describeWorkflowRule } from "./describe-workflow-rule";

const t = ((key: string, values?: Record<string, unknown>) =>
  values?.column ? `${key}:${values.column}` : key) as unknown as TFunction;

describe("describeWorkflowRule", () => {
  it("names the target column and the event source", () => {
    expect(
      describeWorkflowRule(
        {
          columnName: "Done",
          eventType: "pr_merged",
          integrationType: "gitea",
        },
        t,
      ),
    ).toEqual({
      title: "agent:automations.rule.when.pr_merged:Done",
      detail: "settings:workflowEditor.events.pr_merged · Gitea",
    });
  });

  it("falls back to the event and raw provider", () => {
    expect(
      describeWorkflowRule(
        { columnName: null, eventType: "pr_opened", integrationType: "other" },
        t,
      ),
    ).toEqual({
      title: "settings:workflowEditor.events.pr_opened",
      detail: "settings:workflowEditor.events.pr_opened · other",
    });
  });
});
