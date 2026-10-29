import { and, eq, isNotNull } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { eventContext, subscribeToEvent } from "../../events";
import { createNextOccurrence } from "./create-next-occurrence";

async function continueSeries(data: {
  taskId: string;
  userId?: string | null;
}) {
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
}

// Imports announce status changes as task.updated; project moves use task.moved.
// Every path uses the same idempotent rule handoff.
for (const eventType of ["task.status_changed", "task.moved", "task.updated"]) {
  subscribeToEvent(eventType, continueSeries);
}

subscribeToEvent<{ projectId: string; status: string; isFinal: boolean }>(
  "column.finality_changed",
  async ({ projectId, status, isFinal }) => {
    if (!isFinal) return;
    const tasks = await db
      .select({ taskId: taskTable.id })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.projectId, projectId),
          eq(taskTable.status, status),
          isNotNull(taskTable.recurrence),
        ),
      );
    for (const task of tasks) await continueSeries(task);
  },
);
