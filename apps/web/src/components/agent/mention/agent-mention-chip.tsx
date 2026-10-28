import { AgentMentionIcon } from "./agent-mention-icon";
import type { AgentMentionType } from "./agent-mention-token";

export function AgentMentionChip({
  type,
  label,
}: {
  type: AgentMentionType;
  label: string;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-info/8 px-1.5 align-bottom font-medium text-info-foreground dark:bg-info/16">
      <AgentMentionIcon type={type} className="size-3" />
      <span className="truncate">{label}</span>
    </span>
  );
}
