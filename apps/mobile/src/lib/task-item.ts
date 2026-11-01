export const UNCHECKED_TASK = "☐";
export const CHECKED_TASK = "☑";

export type MarkdownNode = {
  type: string;
  content?: string;
  children?: MarkdownNode[];
};

function firstText(node: MarkdownNode): MarkdownNode | null {
  if (node.type === "text") return node;
  for (const child of node.children ?? []) {
    if (child.type === "bullet_list" || child.type === "ordered_list") break;
    const found = firstText(child);
    if (found) return found;
  }
  return null;
}

export function taskItemState(
  node: MarkdownNode,
): "checked" | "unchecked" | null {
  const content = firstText(node)?.content ?? "";
  if (content.startsWith(CHECKED_TASK)) return "checked";
  if (content.startsWith(UNCHECKED_TASK)) return "unchecked";
  return null;
}

export function stripTaskMarker(content: string): string {
  return content.replace(/^[☐☑] ?/, "");
}
