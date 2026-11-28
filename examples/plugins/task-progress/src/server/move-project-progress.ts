import type { PluginStorage } from "@kaneo/plugin-sdk/server";
import { projectPrefix } from "./progress-key.js";

const BATCH_SIZE = 1000;

export async function moveProjectProgress(
  from: PluginStorage,
  to: PluginStorage,
  projectId: string,
): Promise<void> {
  const prefix = projectPrefix(projectId);
  for (;;) {
    const entries = await from.list<number>({ prefix, limit: BATCH_SIZE });
    for (const entry of entries) {
      if ((await to.get<number>(entry.key)) === undefined) {
        await to.set(entry.key, entry.value);
      }
      await from.delete(entry.key);
    }
    if (entries.length < BATCH_SIZE) return;
  }
}
