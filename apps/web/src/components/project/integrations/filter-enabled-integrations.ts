import type { IntegrationStatus } from "./get-integration-status";
import type { IntegrationId } from "./integration-definitions";
import type { IntegrationDefinition } from "./integration-definitions";

// The API names the generic webhook provider `generic-webhook`.
export function providerType(id: IntegrationDefinition["id"]) {
  return id === "webhook" ? "generic-webhook" : id;
}

/** Keep saved connections removable even when their provider is turned off. */
export function filterEnabledIntegrations(
  integrations: IntegrationDefinition[],
  disabledProviders: readonly string[],
  statuses: Partial<Record<IntegrationId, IntegrationStatus>> = {},
) {
  return integrations.filter(
    (integration) =>
      !disabledProviders.includes(providerType(integration.id)) ||
      statuses[integration.id]?.state === "connected" ||
      statuses[integration.id]?.state === "paused",
  );
}
