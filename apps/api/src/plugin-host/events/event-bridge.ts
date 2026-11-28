import type { PluginEvent } from "@kaneo/plugin-sdk";
import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { pluginStorageTable } from "../../database/schema";
import { subscribeToEvent } from "../../events";
import { listWorkspacePlugins } from "../data/workspace-plugins";
import { enabledInAnyWorkspace } from "../enablement/resolve-enabled";
import { listLoadedPlugins } from "../registry";
import { deliverEvent, pluginsHandling } from "./deliver-event";
import { eventWorkspaces } from "./event-workspaces";
import { INTERNAL_EVENT_NAMES, mapInternalEvent } from "./map-internal-event";

let started = false;

export async function bridgeInternalEvent(
  name: string,
  data: unknown,
): Promise<void> {
  const mapped = mapInternalEvent(name, data);
  if (!mapped) return;

  const plugins = pluginsHandling(listLoadedPlugins(), mapped.type);
  if (plugins.length === 0) return;

  const workspaces = eventWorkspaces(mapped, data);
  if (!workspaces) return;

  const enabled = enabledInAnyWorkspace(
    plugins,
    await Promise.all(workspaces.enabledIn.map(listWorkspacePlugins)),
  );
  if (mapped.type === "project.moved") {
    const retained = await db
      .selectDistinct({ pluginId: pluginStorageTable.pluginId })
      .from(pluginStorageTable)
      .where(
        and(
          eq(pluginStorageTable.workspaceId, mapped.fromWorkspaceId),
          inArray(
            pluginStorageTable.pluginId,
            plugins.map((plugin) => plugin.id),
          ),
        ),
      );
    for (const { pluginId } of retained) enabled.add(pluginId);
  }

  await deliverEvent(plugins, enabled, {
    ...mapped,
    workspaceId: workspaces.workspaceId,
  } as PluginEvent);
}

export function startPluginEventBridge(): void {
  if (started || !listLoadedPlugins().some((plugin) => plugin.server)) return;
  started = true;
  for (const name of INTERNAL_EVENT_NAMES) {
    void subscribeToEvent(name, (data: unknown) =>
      bridgeInternalEvent(name, data),
    );
  }
}
