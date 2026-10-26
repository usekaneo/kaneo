import { eventContext, subscribeToEvent } from "../../events";
import { createNextOccurrence } from "./create-next-occurrence";

// Project moves publish task.moved even when the destination column completes
// the task. Both events use the same idempotent rule handoff.
for (const eventType of ["task.status_changed", "task.moved"]) {
  subscribeToEvent<{ taskId: string; userId?: string | null }>(
    eventType,
    async (data) => {
      // Leave the completing request's context so task.created reaches its own
      // window too: that client may have refetched the board before this insert.
      await eventContext.exit(() =>
        createNextOccurrence(data.taskId, data.userId).catch((error) => {
          console.error(
            `Failed to create the next occurrence of task ${data.taskId}`,
            error,
          );
        }),
      );
    },
  );
}
