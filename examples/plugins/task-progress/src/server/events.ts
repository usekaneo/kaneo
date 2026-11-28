import type { Kaneo } from "./context.js";
import { inOrder } from "./in-order.js";
import { moveProjectProgress } from "./move-project-progress.js";
import { progressKey } from "./progress-key.js";

export function registerEvents(kaneo: Kaneo) {
  const run = inOrder();

  kaneo.on("task.status_changed", (event) =>
    run(async () => {
      if (!kaneo.options.autoComplete) return;
      const { doneStatus } = await kaneo.settings(event.workspaceId);
      if (event.to !== doneStatus) return;
      await kaneo
        .storage(event.workspaceId)
        .set(progressKey(event.projectId, event.taskId), 100);
    }),
  );

  kaneo.on("task.moved", (event) =>
    run(async () => {
      const storage = kaneo.storage(event.workspaceId);
      const from = progressKey(event.fromProjectId, event.taskId);
      const value = await storage.get<number>(from);
      if (value === undefined) return;
      await storage.set(progressKey(event.toProjectId, event.taskId), value);
      await storage.delete(from);
    }),
  );

  kaneo.on("task.deleted", (event) =>
    run(() =>
      kaneo
        .storage(event.workspaceId)
        .delete(progressKey(event.projectId, event.taskId)),
    ),
  );

  kaneo.on("project.moved", (event) =>
    run(() =>
      moveProjectProgress(
        kaneo.storage(event.fromWorkspaceId),
        kaneo.storage(event.toWorkspaceId),
        event.projectId,
      ),
    ),
  );
}
