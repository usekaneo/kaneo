import { eq } from "drizzle-orm";
import db from "../../database";
import type { DbOrTx } from "../../project-access/db-or-tx";
import {
  pluginStorageTable,
  workspacePluginTable,
} from "../../database/schema";

export type PluginDataCounts = {
  storage: number;
  workspaces: number;
};

export async function deletePluginData(
  pluginId: string,
  onDeleted: (tx: DbOrTx, counts: PluginDataCounts) => Promise<void>,
): Promise<PluginDataCounts> {
  return db.transaction(async (tx) => {
    const storage = await tx
      .delete(pluginStorageTable)
      .where(eq(pluginStorageTable.pluginId, pluginId));
    const workspaces = await tx
      .delete(workspacePluginTable)
      .where(eq(workspacePluginTable.pluginId, pluginId));
    const counts = {
      storage: storage.rowCount ?? 0,
      workspaces: workspaces.rowCount ?? 0,
    };
    await onDeleted(tx, counts);
    return counts;
  });
}
