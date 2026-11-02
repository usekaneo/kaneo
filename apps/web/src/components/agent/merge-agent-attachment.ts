import type { AgentAttachmentDraft } from "./agent-attachment-draft";
import {
  agentAttachmentLimits,
  type AgentAttachmentError,
} from "./read-agent-attachments";

// Read results are candidates, never replacements for the live attachment list.
export function mergeAgentAttachment(
  current: AgentAttachmentDraft[],
  candidate: AgentAttachmentDraft,
): { attachments: AgentAttachmentDraft[]; error?: AgentAttachmentError } {
  const kept =
    candidate.kind === "text"
      ? current.filter(
          (item) => item.kind !== "text" || item.name !== candidate.name,
        )
      : current;
  if (kept.length >= agentAttachmentLimits.files)
    return { attachments: current, error: "tooMany" };
  const characters = [...kept, candidate].reduce(
    (total, item) => total + (item.kind === "text" ? item.content.length : 0),
    0,
  );
  if (characters > agentAttachmentLimits.totalCharacters)
    return { attachments: current, error: "tooLarge" };
  return { attachments: [...kept, candidate] };
}
