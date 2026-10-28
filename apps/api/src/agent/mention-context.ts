export type MentionedItem =
  | {
      type: "task";
      id: string;
      title: string;
      key: string | null;
      status: string;
      project: string;
    }
  | { type: "project"; id: string; name: string; key: string };

// Titles are user content; keep each item on one line and inside the block.
function clean(value: string) {
  return JSON.stringify(value.replace(/[<>]/g, "_").slice(0, 300));
}

function describe(item: MentionedItem) {
  if (item.type === "project")
    return `- project ${clean(item.name)} key=${item.key} id=${item.id}`;
  return `- task ${clean(item.title)} key=${item.key ?? "none"} status=${item.status} project=${clean(item.project)} id=${item.id}`;
}

export function withMentionContext(prompt: string, items: MentionedItem[]) {
  if (items.length === 0) return prompt;
  return `${prompt}\n\n<mentioned_items>\n${items.map(describe).join("\n")}\n</mentioned_items>`;
}
