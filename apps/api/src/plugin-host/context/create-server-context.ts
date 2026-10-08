import {
  PLUGIN_EVENT_NAMES,
  type PluginEvent,
  type PluginEventName,
  readSettings,
  type SettingsSchema,
} from "@kaneo/plugin-sdk";
import type { ServerContext } from "@kaneo/plugin-sdk/server";
import {
  getWorkspacePlugin,
  listEnabledWorkspaceIds,
} from "../data/workspace-plugins";
import type { LoadedPlugin, PluginServerRuntime } from "../types";
import { createPluginGuards } from "./guards";
import { createPluginLogger } from "./logger";
import { schedulePluginJob } from "./plugin-jobs";
import { createPluginStorage } from "./storage";

type HostContext = ServerContext<unknown, SettingsSchema>;

function isPluginEventName(name: unknown): name is PluginEventName {
  return (PLUGIN_EVENT_NAMES as readonly unknown[]).includes(name);
}

export function createServerContext(
  plugin: Pick<
    LoadedPlugin,
    "id" | "version" | "official" | "options" | "settings"
  >,
  runtime: PluginServerRuntime,
): HostContext {
  const log = createPluginLogger(plugin.id);

  return {
    plugin: { id: plugin.id, version: plugin.version },
    options: plugin.options,
    log,
    routes: runtime.routes as unknown as HostContext["routes"],
    webhooks: runtime.webhooks as unknown as HostContext["webhooks"],
    guard: createPluginGuards(plugin) as unknown as HostContext["guard"],
    on(event, handler) {
      if (!isPluginEventName(event)) {
        throw new Error(
          `Unknown event "${String(event)}". Use one of: ${PLUGIN_EVENT_NAMES.join(", ")}.`,
        );
      }
      const handlers = runtime.handlers.get(event) ?? [];
      handlers.push(handler as (event: PluginEvent) => void | Promise<void>);
      runtime.handlers.set(event, handlers);
    },
    storage: (workspaceId) => createPluginStorage(plugin.id, workspaceId),
    settings: async (workspaceId) =>
      readSettings(
        plugin.settings,
        (await getWorkspacePlugin(plugin.id, workspaceId))?.settings ?? {},
      ),
    enabledWorkspaces: () => listEnabledWorkspaceIds(plugin),
    schedule: (name, cron, run) =>
      schedulePluginJob(plugin.id, name, cron, run, log),
  };
}
