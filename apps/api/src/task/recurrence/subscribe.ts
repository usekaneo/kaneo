import { eventContext, subscribeToEvent } from "../../events";
import { createNextOccurrence } from "./create-next-occurrence";

// Every completion path (status, drag, bulk, full update, and integrations)
// publishes task.status_changed after its transaction commits.
subscribeToEvent<{ taskId: string; userId?: string | null }>(
  "task.status_changed",
  async (data) => {
    // Leave the completing request's context so task.created reaches its own
    // window too: that client may have refetched the board before this insert.
    await eventContext.exit(() =>
      createNextOccurrence(data.taskId, data.userId),
    );
  },
);
