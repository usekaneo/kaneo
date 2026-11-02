import { createHash } from "node:crypto";
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
    await subscribeToEvent<AutomationDomainEvent>(
      domain,
      async (incoming, event) => {
        const data =
          !incoming.projectId && incoming.toProjectId
            ? { ...incoming, projectId: incoming.toProjectId }
            : incoming;
        // Moves use the identity captured at publication, never a mutable task
        // revision read after later moves. Provider receipt IDs remain stable.
        const key =
          data.eventId ??
          (trigger === "task_moved"
            ? event.id
            : trigger === "task_created"
              ? data.taskId
              : (data.commentId ?? data.id));
        const hash = createHash("sha256")
          .update(key ?? JSON.stringify(data))
          .digest("hex");
        await ingestAutomationEvent(trigger, data, `${trigger}:${hash}`);
      },
    );
}
