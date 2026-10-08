import type { Kaneo } from "./context.js";
import { progressKey } from "./progress-key.js";

export function registerEvents(kaneo: Kaneo) {
  kaneo.on("task.status_changed", async (event) => {
    if (!kaneo.options.autoComplete) return;
    const { doneStatus } = await kaneo.settings(event.workspaceId);
    if (event.to !== doneStatus) return;
    await kaneo
      .storage(event.workspaceId)
      .set(progressKey(event.projectId, event.taskId), 100);
  });

  kaneo.on("task.moved", async (event) => {
    const storage = kaneo.storage(event.workspaceId);
    const from = progressKey(event.fromProjectId, event.taskId);
    const value = await storage.get<number>(from);
    if (value === undefined) return;
    await storage.set(progressKey(event.toProjectId, event.taskId), value);
    await storage.delete(from);
  });

  kaneo.on("task.deleted", async (event) => {
    await kaneo
      .storage(event.workspaceId)
      .delete(progressKey(event.projectId, event.taskId));
  });
}
