import type { ServerPluginDefinition } from "@kaneo/plugin-sdk/server";
import type { LoadedPlugin, PluginServerRuntime } from "../types";
import {
  createPluginRoutesApp,
  createPluginWebhooksApp,
} from "./create-plugin-apps";
import { createServerContext } from "./create-server-context";

export async function startServerPlugin(
  plugin: Pick<
    LoadedPlugin,
    "id" | "version" | "official" | "options" | "settings"
  >,
  definition: ServerPluginDefinition,
): Promise<PluginServerRuntime> {
  const runtime: PluginServerRuntime = {
    routes: createPluginRoutesApp(plugin.id),
    webhooks: createPluginWebhooksApp(plugin.id),
    handlers: new Map(),
  };
  await definition.setup(createServerContext(plugin, runtime));
  return runtime;
}
