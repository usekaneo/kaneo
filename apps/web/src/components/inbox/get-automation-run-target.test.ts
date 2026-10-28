import { describe, expect, it } from "vite-plus/test";
import type { Notification } from "@/types/notification";
import { getAutomationRunTarget } from "./get-automation-run-target";

const notification = (patch: Partial<Notification>) =>
  ({
    resourceType: "agent_run",
    eventData: { workspaceId: "w", automationId: "a", runId: "r" },
    ...patch,
  }) as Notification;

describe("getAutomationRunTarget", () => {
  it("reads the automation run from event data", () => {
    expect(getAutomationRunTarget(notification({}))).toEqual({
      workspaceId: "w",
      automationId: "a",
      runId: "r",
    });
  });

  it("ignores other resources and incomplete data", () => {
    expect(
      getAutomationRunTarget(notification({ resourceType: "task" })),
    ).toBeNull();
    expect(
      getAutomationRunTarget(
        notification({ eventData: { workspaceId: "w", runId: "r" } }),
      ),
    ).toBeNull();
    expect(
      getAutomationRunTarget(notification({ eventData: null })),
    ).toBeNull();
  });
});
