import { describe, expect, it } from "vite-plus/test";
import { getAutomationStatus } from "./get-automation-status";

const running = {
  enabled: true,
  pausedReason: null,
  lastSkipReason: null,
} as const;

describe("getAutomationStatus", () => {
  it("shows nothing while an automation runs normally", () => {
    expect(getAutomationStatus(running)).toBeNull();
  });

  it("prefers pause reasons over the enabled flag", () => {
    expect(
      getAutomationStatus({
        ...running,
        enabled: false,
        pausedReason: "owner_access",
      }),
    ).toEqual({
      key: "agent:automations.status.pausedAccess",
      tone: "destructive",
    });
    expect(
      getAutomationStatus({
        ...running,
        enabled: false,
        pausedReason: "failures",
      })?.key,
    ).toBe("agent:automations.status.pausedFailures");
  });

  it("shows a turned-off automation as off, not skipped", () => {
    expect(
      getAutomationStatus({
        ...running,
        enabled: false,
        lastSkipReason: "budget",
      })?.key,
    ).toBe("agent:automations.status.off");
  });

  it("surfaces skipped runs", () => {
    expect(
      getAutomationStatus({ ...running, lastSkipReason: "budget" }),
    ).toEqual({ key: "agent:automations.status.budget", tone: "warning" });
    expect(
      getAutomationStatus({ ...running, lastSkipReason: "daily_limit" })?.key,
    ).toBe("agent:automations.status.dailyLimit");
    expect(
      getAutomationStatus({ ...running, lastSkipReason: "unavailable" })?.key,
    ).toBe("agent:automations.status.unavailable");
    expect(
      getAutomationStatus({ ...running, lastSkipReason: "overlap" })?.tone,
    ).toBe("muted");
  });
});
