import { describe, expect, it } from "vite-plus/test";
import { integrationTriggerLabel } from "./integration-trigger-label";

describe("integrationTriggerLabel", () => {
  it.each([
    ["disconnected", false, "settings:projectIntegrations.connect"],
    ["disconnected", true, "common:actions.cancel"],
    ["connected", false, "settings:projectIntegrations.configure"],
    ["paused", true, "settings:projectIntegrations.done"],
    ["unavailable", true, "settings:projectIntegrations.done"],
    ["loading", false, "common:empty.loading"],
  ] as const)("labels %s (open: %s) as %s", (state, open, label) => {
    expect(integrationTriggerLabel(state, open)).toBe(label);
  });
});
