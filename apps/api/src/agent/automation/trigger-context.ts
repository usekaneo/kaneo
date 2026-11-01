import type { MentionedItem } from "../mention-context";
import type { AgentRunTrigger } from "./types";

type TaskItem = Extract<MentionedItem, { type: "task" }>;

// Event text is workspace content; keep each value on one line and unable to
// close the block.
function clean(value: string, max = 300) {
  return JSON.stringify(value.replace(/[<>]/g, "_").slice(0, max));
}

// Appends what started an automation run. Events whose task the owner can no
// longer read (missing from `tasks`) are dropped without a trace.
export function withAutomationContext(
  prompt: string,
  trigger: AgentRunTrigger,
  tasks: TaskItem[],
) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const lines = trigger.events.flatMap((event) => {
    const task = byId.get(event.taskId);
    if (!task) return [];
    const parts = [
      `- ${event.event}`,
      `at=${event.occurredAt}`,
      event.actorName ? `by=${clean(event.actorName, 100)}` : null,
      `task ${clean(task.title)} key=${task.key ?? "none"} status=${task.status} project=${clean(task.project)} id=${task.id}`,
      event.columnName ? `column=${clean(event.columnName, 100)}` : null,
      event.pullRequest
        ? `pull_request=#${event.pullRequest.number} ${clean(event.pullRequest.title)}`
        : null,
      event.commentPreview ? `comment=${clean(event.commentPreview)}` : null,
    ];
    return [parts.filter(Boolean).join(" ")];
  });
  const hidden = trigger.events.length - lines.length;
  const more = trigger.moreEvents + hidden;
  if (more > 0) lines.push(`- ${more} more events not listed`);
  const attributes = [
    `source=${trigger.source}`,
    trigger.scheduledFor ? `scheduled_for=${trigger.scheduledFor}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return `${prompt}\n\n<automation_trigger ${attributes}>\n${lines.join("\n")}${lines.length ? "\n" : ""}</automation_trigger>`;
}
