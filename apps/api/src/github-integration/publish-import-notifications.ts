import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { RequestLease } from "../database/request-lease";
import { githubImportTable } from "../database/schema";
import { publishEvent } from "../events";

export async function publishImportNotifications(
  savedRun: typeof githubImportTable.$inferSelect,
  projectId: string,
  lease: RequestLease,
) {
  let run = savedRun;
  while (run.state.pendingNotifications?.length) {
    const [notification, ...remaining] = run.state.pendingNotifications;
    if (!notification) break;
    await lease.check();
    await publishEvent(
      notification.type,
      {
        projectId,
        ...("taskId" in notification ? { taskId: notification.taskId } : {}),
      },
      { requireDelivery: true },
    );
    // Refresh notifications may repeat when delivery succeeds but acknowledgement
    // does not. Never advance the next page until this page's queue is drained.
    run = await lease.transaction(async (tx) => {
      const [saved] = await tx
        .update(githubImportTable)
        .set({ state: { ...run.state, pendingNotifications: remaining } })
        .where(
          and(
            eq(githubImportTable.integrationId, run.integrationId),
            eq(githubImportTable.runId, run.runId),
          ),
        )
        .returning();
      if (!saved)
        throw new HTTPException(409, {
          message: "GitHub import changed; refresh before resuming",
        });
      return saved;
    });
  }
  return run;
}
