import { PLUGIN_API_VERSION } from "../api-version.js";
import type { WebPluginConfig, WebPluginDefinition } from "./types.js";

export function defineWeb(config: WebPluginConfig): WebPluginDefinition {
  return {
    ...config,
    kind: "kaneo-web",
    apiVersion: PLUGIN_API_VERSION,
  };
}

export function isWebPluginDefinition(
  value: unknown,
): value is WebPluginDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "kaneo-web"
  );
}
