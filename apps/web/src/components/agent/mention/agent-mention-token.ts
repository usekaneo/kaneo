export type AgentMentionType = "task" | "project";
export type AgentMentionRef = { type: AgentMentionType; id: string };
export type AgentMention = AgentMentionRef & { label: string };
// `start` is the segment's offset in the prompt.
export type AgentPromptSegment =
  | { kind: "text"; start: number; text: string }
  | { kind: "mention"; start: number; mention: AgentMention };

// The prompt carries mentions as `@[Launch v3](project:ID)`. The API parses the
// same format (apps/api/src/agent/mention-token.ts); keep the two in sync.
const MENTION_PATTERN =
  /@\[([^\]\n]{1,200})\]\((task|project):([A-Za-z0-9_-]{1,128})\)/g;

export function cleanAgentMentionLabel(label: string) {
  const clean = label
    .replace(/[[\]\s]+/g, " ")
    .trim()
    .slice(0, 120)
    .trim();
  return clean || "…";
}

export function serializeAgentMention({ type, id, label }: AgentMention) {
  return `@[${cleanAgentMentionLabel(label)}](${type}:${id})`;
}

export function splitAgentPrompt(text: string): AgentPromptSegment[] {
  const segments: AgentPromptSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_PATTERN)) {
    if (match.index > last)
      segments.push({
        kind: "text",
        start: last,
        text: text.slice(last, match.index),
      });
    segments.push({
      kind: "mention",
      start: match.index,
      mention: {
        label: match[1] as string,
        type: match[2] as AgentMentionType,
        id: match[3] as string,
      },
    });
    last = match.index + match[0].length;
  }
  if (last < text.length)
    segments.push({ kind: "text", start: last, text: text.slice(last) });
  return segments;
}

// Distinct references in order of first appearance, as the API expects.
export function getAgentMentionRefs(text: string): AgentMentionRef[] {
  const seen = new Set<string>();
  return splitAgentPrompt(text).flatMap((segment) => {
    if (segment.kind !== "mention") return [];
    const { type, id } = segment.mention;
    if (seen.has(`${type}:${id}`)) return [];
    seen.add(`${type}:${id}`);
    return [{ type, id }];
  });
}

export function agentPromptToPlainText(text: string) {
  return splitAgentPrompt(text)
    .map((segment) =>
      segment.kind === "text" ? segment.text : `@${segment.mention.label}`,
    )
    .join("");
}
