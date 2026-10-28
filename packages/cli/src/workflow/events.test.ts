import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  eventLabel,
  integrationLabel,
  parseIntegration,
  parseWorkflowEvent,
} from "./events.js";

describe("parseWorkflowEvent", () => {
  it("accepts the API name with hyphens, spaces or any case", () => {
    expect(parseWorkflowEvent("pr_merged")).toEqual(
      Result.succeed("pr_merged"),
    );
    expect(parseWorkflowEvent("PR-Merged")).toEqual(
      Result.succeed("pr_merged"),
    );
    expect(parseWorkflowEvent("issue closed")).toEqual(
      Result.succeed("issue_closed"),
    );
  });

  it("accepts the readable label and a few aliases", () => {
    expect(parseWorkflowEvent("Pull request opened")).toEqual(
      Result.succeed("pr_opened"),
    );
    expect(parseWorkflowEvent("push")).toEqual(Result.succeed("branch_push"));
    expect(parseWorkflowEvent("mr-merged")).toEqual(
      Result.succeed("pr_merged"),
    );
  });

  it("lists the events when nothing matches", () => {
    const result = parseWorkflowEvent("deploy");
    expect(Result.isFailure(result) && result.failure.hint).toBe(
      "Use one of: branch_push, pr_opened, pr_merged, issue_opened, issue_closed, issue_reopened.",
    );
  });
});

describe("parseIntegration", () => {
  it("accepts the three git providers", () => {
    expect(parseIntegration("GitHub")).toEqual(Result.succeed("github"));
    expect(parseIntegration(" gitlab ")).toEqual(Result.succeed("gitlab"));
  });

  it("refuses other integrations", () => {
    const result = parseIntegration("slack");
    expect(Result.isFailure(result) && result.failure.hint).toBe(
      "Use github, gitlab or gitea.",
    );
  });
});

describe("labels", () => {
  it("names known values and passes unknown ones through", () => {
    expect(integrationLabel("gitea")).toBe("Gitea");
    expect(eventLabel("branch_push")).toBe("Branch pushed");
    expect(eventLabel("custom_event")).toBe("custom_event");
  });
});
