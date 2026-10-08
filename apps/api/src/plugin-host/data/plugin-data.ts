import { count, eq } from "drizzle-orm";
import db from "../../database";
import {
  pluginStorageTable,
  workspacePluginTable,
} from "../../database/schema";

export type PluginDataCounts = {
  storage: number;
  workspaces: number;
};

export async function countPluginData(
  pluginId: string,
): Promise<PluginDataCounts> {
  const [storage] = await db
    .select({ rows: count() })
    .from(pluginStorageTable)
    .where(eq(pluginStorageTable.pluginId, pluginId));
  const [workspaces] = await db
    .select({ rows: count() })
    .from(workspacePluginTable)
    .where(eq(workspacePluginTable.pluginId, pluginId));
  return { storage: storage?.rows ?? 0, workspaces: workspaces?.rows ?? 0 };
}

export async function deletePluginData(
  pluginId: string,
): Promise<PluginDataCounts> {
  return db.transaction(async (tx) => {
    const storage = await tx
      .delete(pluginStorageTable)
      .where(eq(pluginStorageTable.pluginId, pluginId));
    const workspaces = await tx
      .delete(workspacePluginTable)
      .where(eq(workspacePluginTable.pluginId, pluginId));
    return {
      storage: storage.rowCount ?? 0,
      workspaces: workspaces.rowCount ?? 0,
    };
  });
}
