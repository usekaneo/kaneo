import { describe, expect, it } from "vite-plus/test";
import { filterEnabledIntegrations } from "./filter-enabled-integrations";
import type { IntegrationDefinition } from "./integration-definitions";

const definition = (id: IntegrationDefinition["id"]) =>
  ({ id }) as IntegrationDefinition;

describe("filterEnabledIntegrations", () => {
  it("drops turned-off providers, mapping the generic webhook name", () => {
    const all = [
      definition("github"),
      definition("slack"),
      definition("webhook"),
    ];
    expect(
      filterEnabledIntegrations(all, ["slack", "generic-webhook"]).map(
        (integration) => integration.id,
      ),
    ).toEqual(["github"]);
    expect(filterEnabledIntegrations(all, [])).toEqual(all);
    expect(
      filterEnabledIntegrations(all, ["github", "slack", "generic-webhook"], {
        github: { state: "connected" },
        slack: { state: "disconnected" },
        webhook: { state: "paused" },
      }).map((integration) => integration.id),
    ).toEqual(["github", "webhook"]);
  });
});
