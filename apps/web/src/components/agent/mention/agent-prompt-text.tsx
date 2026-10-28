import { AgentMentionChip } from "./agent-mention-chip";
import { splitAgentPrompt } from "./agent-mention-token";

// A sent prompt with its mention tokens shown as chips.
export function AgentPromptText({ prompt }: { prompt: string }) {
  return splitAgentPrompt(prompt).map((segment) =>
    segment.kind === "text" ? (
      <span key={segment.start}>{segment.text}</span>
    ) : (
      <AgentMentionChip
        key={segment.start}
        type={segment.mention.type}
        label={segment.mention.label}
      />
    ),
  );
}
