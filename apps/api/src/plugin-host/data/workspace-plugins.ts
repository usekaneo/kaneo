import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  utcNow,
  workspacePluginTable,
  workspaceTable,
} from "../../database/schema";
import {
  type EnablementPlugin,
  enabledWorkspaceIds,
  resolvePluginEnabled,
} from "../enablement/resolve-enabled";
import type { WorkspacePluginWrite } from "./workspace-plugin-write";

export type WorkspacePluginRow = {
  pluginId: string;
  enabled: boolean;
  settings: Record<string, unknown>;
};

const columns = {
  pluginId: workspacePluginTable.pluginId,
  enabled: workspacePluginTable.enabled,
  settings: workspacePluginTable.settings,
};

export async function getWorkspacePlugin(
  pluginId: string,
  workspaceId: string,
): Promise<WorkspacePluginRow | undefined> {
  const [row] = await db
    .select(columns)
    .from(workspacePluginTable)
    .where(
      and(
        eq(workspacePluginTable.pluginId, pluginId),
        eq(workspacePluginTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return row;
}

export async function listWorkspacePlugins(
  workspaceId: string,
): Promise<WorkspacePluginRow[]> {
  return db
    .select(columns)
    .from(workspacePluginTable)
    .where(eq(workspacePluginTable.workspaceId, workspaceId));
}

export async function isPluginEnabled(
  plugin: EnablementPlugin,
  workspaceId: string,
): Promise<boolean> {
  const row = await getWorkspacePlugin(plugin.id, workspaceId);
  return resolvePluginEnabled(plugin, row?.enabled);
}

export async function listEnabledWorkspaceIds(
  plugin: EnablementPlugin,
): Promise<string[]> {
  const workspaces = await db
    .select({
      workspaceId: workspaceTable.id,
      enabled: workspacePluginTable.enabled,
    })
    .from(workspaceTable)
    .leftJoin(
      workspacePluginTable,
      and(
        eq(workspacePluginTable.workspaceId, workspaceTable.id),
        eq(workspacePluginTable.pluginId, plugin.id),
      ),
    )
    .orderBy(workspaceTable.id);
  return enabledWorkspaceIds(plugin, workspaces);
}

export async function saveWorkspacePlugin(
  pluginId: string,
  workspaceId: string,
  write: WorkspacePluginWrite,
): Promise<WorkspacePluginRow> {
  const [row] = await db
    .insert(workspacePluginTable)
    .values({ pluginId, workspaceId, ...write.insert })
    .onConflictDoUpdate({
      target: [workspacePluginTable.workspaceId, workspacePluginTable.pluginId],
      set: { ...write.update, updatedAt: utcNow },
    })
    .returning(columns);
  if (!row) {
    throw new Error("Failed to save the workspace plugin");
  }
  return row;
}
