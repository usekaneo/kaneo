import type { IntegrationState } from "@/components/project/integrations/get-integration-status";

export function integrationTriggerLabel(
  state: IntegrationState,
  open: boolean,
) {
  const isSetUp = state === "connected" || state === "paused";
  if (open)
    return state === "disconnected"
      ? "common:actions.cancel"
      : "settings:projectIntegrations.done";
  if (state === "loading") return "common:empty.loading";
  return isSetUp
    ? "settings:projectIntegrations.configure"
    : "settings:projectIntegrations.connect";
}
