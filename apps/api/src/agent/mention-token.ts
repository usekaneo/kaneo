export type AgentMentionRef = { type: "task" | "project"; id: string };

export const AGENT_MENTION_LIMIT = 10;

// Composer mentions travel inside the prompt as `@[Launch v3](project:ID)`, so
// stored prompts stay readable and later turns keep the reference. The web
// composer writes the same format (apps/web/src/components/agent/mention).
const MENTION_PATTERN =
  /@\[([^\]\n]{1,200})\]\((task|project):([A-Za-z0-9_-]{1,128})\)/g;

// Distinct references in order of first appearance.
export function parseMentionRefs(prompt: string): AgentMentionRef[] {
  const seen = new Set<string>();
  const refs: AgentMentionRef[] = [];
  for (const match of prompt.matchAll(MENTION_PATTERN)) {
    const type = match[2] as AgentMentionRef["type"];
    const id = match[3] as string;
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ type, id });
  }
  return refs;
}

export function sameMentionRefs(
  left: AgentMentionRef[],
  right: AgentMentionRef[],
) {
  const keys = (refs: AgentMentionRef[]) =>
    refs.map((ref) => `${ref.type}:${ref.id}`).sort();
  return JSON.stringify(keys(left)) === JSON.stringify(keys(right));
}
