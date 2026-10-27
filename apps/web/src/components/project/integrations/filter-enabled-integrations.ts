import type { IntegrationDefinition } from "./integration-definitions";

// The API names the generic webhook provider `generic-webhook`.
function providerType(id: IntegrationDefinition["id"]) {
  return id === "webhook" ? "generic-webhook" : id;
}

/** Leave out providers an administrator turned off. */
export function filterEnabledIntegrations(
  integrations: IntegrationDefinition[],
  disabledProviders: readonly string[],
) {
  return integrations.filter(
    (integration) => !disabledProviders.includes(providerType(integration.id)),
  );
}
