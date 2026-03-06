type ProseMirrorNodeJSON = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNodeJSON[];
  text?: string;
};

const TASK_LINE_REGEX = /^\s*[-*]\s+\[( |x|X)\]\s*(.*)$/;
const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;

function createParagraphNode(text: string): ProseMirrorNodeJSON {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return { type: "paragraph" };
  }

  return {
    type: "paragraph",
    content: [{ type: "text", text: normalizedText }],
  };
}

export function parseTaskListMarkdownToNodes(
  rawText: string,
): ProseMirrorNodeJSON[] | null {
  if (!/(?:^|\n)\s*[-*]\s+\[(?: |x|X)\]\s+/.test(rawText)) {
    return null;
  }

  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const nodes: ProseMirrorNodeJSON[] = [];
  let taskItems: ProseMirrorNodeJSON[] = [];
  let hasTaskItems = false;

  const flushTaskItems = () => {
    if (!taskItems.length) return;
    nodes.push({
      type: "taskList",
      content: taskItems,
    });
    taskItems = [];
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      flushTaskItems();
      continue;
    }

    const taskMatch = TASK_LINE_REGEX.exec(line);
    if (taskMatch) {
      hasTaskItems = true;
      taskItems.push({
        type: "taskItem",
        attrs: { checked: taskMatch[1].toLowerCase() === "x" },
        content: [createParagraphNode(taskMatch[2] || "")],
      });
      continue;
    }

    flushTaskItems();

    const headingMatch = HEADING_REGEX.exec(trimmedLine);
    if (headingMatch) {
      nodes.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: [{ type: "text", text: headingMatch[2].trim() }],
      });
      continue;
    }

    nodes.push(createParagraphNode(trimmedLine));
  }

  flushTaskItems();

  if (!hasTaskItems || !nodes.length) {
    return null;
  }

  return nodes;
}
