import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { subscribeToEvent } from "../../events";
import {
  ingestAutomationEvent,
  type AutomationDomainEvent,
} from "./ingest-event";
import type { AutomationEventName } from "./types";

export async function initializeAutomationEvents() {
  const events: [string, AutomationEventName][] = [
    ["task.created", "task_created"],
    ["task.status_changed", "task_moved"],
    ["task.moved", "task_moved"],
    ["comment.created", "comment_added"],
    ["integration.pr_opened", "pr_opened"],
    ["integration.pr_merged", "pr_merged"],
  ];
  for (const [domain, trigger] of events)
    await subscribeToEvent<AutomationDomainEvent>(domain, async (incoming) => {
      const data =
        !incoming.projectId && incoming.toProjectId
          ? { ...incoming, projectId: incoming.toProjectId }
          : incoming;
      // Durable identities for creation/comments/PRs; status events carry the
      // task revision so a second move to the same column remains a new event.
      let revision: string | undefined;
      if (trigger === "task_moved") {
        const [task] = await db
          .select({ updatedAt: schema.taskTable.updatedAt })
          .from(schema.taskTable)
          .where(eq(schema.taskTable.id, data.taskId));
        revision = `${data.taskId}:${task?.updatedAt.toISOString()}:${data.newStatus}`;
      }
      const key =
        data.eventId ??
        revision ??
        (trigger === "task_created"
          ? data.taskId
          : (data.commentId ?? data.id));
      const hash = createHash("sha256")
        .update(key ?? JSON.stringify(data))
        .digest("hex");
      await ingestAutomationEvent(trigger, data, `${trigger}:${hash}`);
    });
}
