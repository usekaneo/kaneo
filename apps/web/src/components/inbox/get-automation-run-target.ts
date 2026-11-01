import type { Notification } from "@/types/notification";

// Automation digests and failures point at a run on the automation's page.
export function getAutomationRunTarget(notification: Notification) {
  if (notification.resourceType !== "agent_run") return null;
  const data = notification.eventData;
  if (!data || typeof data !== "object") return null;
  const { workspaceId, automationId, runId } = data as Record<string, unknown>;
  if (
    typeof workspaceId !== "string" ||
    typeof automationId !== "string" ||
    typeof runId !== "string"
  )
    return null;
  return { workspaceId, automationId, runId };
}
