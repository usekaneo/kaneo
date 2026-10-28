import { describe, expect, it } from "vite-plus/test";
import type { ChannelAvailabilityMap } from "../notification-channels";
import {
  createWorkspaceRuleState,
  toWorkspaceRuleRequest,
} from "./workspace-rule-state";

const availability: ChannelAvailabilityMap = {
  email: "available",
  gotify: "paused",
  ntfy: "notConnected",
  webhook: "available",
};

describe("createWorkspaceRuleState", () => {
  it("starts a new rule active, on every available channel, for all projects", () => {
    expect(createWorkspaceRuleState(undefined, availability)).toEqual({
      isActive: true,
      emailEnabled: true,
      gotifyEnabled: false,
      ntfyEnabled: false,
      webhookEnabled: true,
      projectMode: "all",
      selectedProjectIds: [],
    });
  });

  it("copies an existing rule", () => {
    const rule = {
      isActive: false,
      emailEnabled: false,
      gotifyEnabled: true,
      ntfyEnabled: false,
      webhookEnabled: false,
      projectMode: "selected" as const,
      selectedProjectIds: ["p1"],
    };

    expect(createWorkspaceRuleState(rule, availability)).toEqual(rule);
  });
});

describe("toWorkspaceRuleRequest", () => {
  it("never sends a channel that is not available globally", () => {
    expect(
      toWorkspaceRuleRequest(
        {
          isActive: true,
          emailEnabled: true,
          gotifyEnabled: true,
          ntfyEnabled: true,
          webhookEnabled: true,
          projectMode: "selected",
          selectedProjectIds: ["p1", "p2"],
        },
        availability,
      ),
    ).toEqual({
      isActive: true,
      emailEnabled: true,
      gotifyEnabled: false,
      ntfyEnabled: false,
      webhookEnabled: true,
      projectMode: "selected",
      selectedProjectIds: ["p1", "p2"],
    });
  });
});
