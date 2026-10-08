import type { PluginEvent } from "@kaneo/plugin-sdk";
import { eq } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { subscribeToEvent } from "../../events";
import { listWorkspacePlugins } from "../data/workspace-plugins";
import { enabledPluginIds } from "../enablement/resolve-enabled";
import { listLoadedPlugins } from "../registry";
import { deliverEvent, pluginsHandling } from "./deliver-event";
import { INTERNAL_EVENT_NAMES, mapInternalEvent } from "./map-internal-event";

let started = false;

async function getProjectWorkspaceId(projectId: string) {
  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);
  return project?.workspaceId ?? null;
}

export async function bridgeInternalEvent(
  name: string,
  data: unknown,
): Promise<void> {
  const mapped = mapInternalEvent(name, data);
  if (!mapped) return;

  const plugins = pluginsHandling(listLoadedPlugins(), mapped.type);
  if (plugins.length === 0) return;

  const workspaceId = await getProjectWorkspaceId(mapped.projectId);
  if (!workspaceId) return;

  const enabled = enabledPluginIds(
    plugins,
    await listWorkspacePlugins(workspaceId),
  );
  await deliverEvent(plugins, enabled, {
    ...mapped,
    workspaceId,
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
