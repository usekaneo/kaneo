import { PLUGIN_API_VERSION } from "../api-version.js";
import type { PluginDescriptor, PluginOptions } from "../define-plugin.js";
import type { SettingsSchema } from "../settings/types.js";
import type { ServerPluginConfig, ServerPluginDefinition } from "./types.js";

export function defineServer<const S extends SettingsSchema = {}>(
  config: ServerPluginConfig<undefined, S>,
): ServerPluginDefinition;
export function defineServer<
  P extends (...args: never[]) => PluginDescriptor<unknown>,
  const S extends SettingsSchema = {},
>(
  plugin: P,
  config: ServerPluginConfig<PluginOptions<P>, S>,
): ServerPluginDefinition;
export function defineServer(
  first: unknown,
  second?: unknown,
): ServerPluginDefinition {
  const config = (second ?? first) as ServerPluginConfig<
    unknown,
    SettingsSchema
  >;
  return {
    kind: "kaneo-server",
    apiVersion: PLUGIN_API_VERSION,
    settings: config.settings ?? {},
    setup: config.setup,
  };
}

export function isServerPluginDefinition(
  value: unknown,
): value is ServerPluginDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "kaneo-server" &&
    typeof (value as { setup?: unknown }).setup === "function"
  );
}
