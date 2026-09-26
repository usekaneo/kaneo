type TaskItemsStats = {
  total: number;
  completed: number;
};

// Card metadata must not parse unbounded legacy/imported descriptions.
export const MAX_TASK_STATS_CHARS = 64 * 1024;

const TASK_ITEM_PATTERN =
  /^\s*(?:>\s*)*(?:[-+*]|\d{1,9}[.)])\s+\[([ xX])\](?:\s|$)/;
const FENCE_PATTERN = /^\s*(?:>\s*)*(`{3,}|~{3,})/;

/**
 * Counts Markdown task-list items in a task description.
 *
 * A task item must start a line (after indentation and optional blockquote
 * prefixes), use a bullet or an ordered-list marker, and have a `[ ]` or
 * `[x]` checkbox. Other checkbox-like text is intentionally ignored.
 *
 * Lines inside fenced code blocks are excluded. Fences may be backticks or
 * tildes, including within blockquotes; a closing fence must use the same
 * character and be at least as long as its opening fence.
 *
 * @param description - Markdown task description, or null when absent.
 * @returns Exact counts, or null when the description exceeds the card budget.
 */
export function getTaskItemStats(
  description: string | null,
): TaskItemsStats | null {
  if (description && description.length > MAX_TASK_STATS_CHARS) return null;
  if (!description) return { total: 0, completed: 0 };

  let total = 0;
  let completed = 0;
  let fenceChar: string | null = null;
  let fenceLen = 0;

  let offset = 0;
  while (offset < description.length) {
    const newline = description.indexOf("\n", offset);
    const end = newline === -1 ? description.length : newline;
    const line = description.slice(offset, end).replace(/\r$/, "");
    offset = end + 1;
    const fenceMatch = FENCE_PATTERN.exec(line);

    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fenceChar) {
        // Opening a new fence
        fenceChar = marker[0];
        fenceLen = marker.length;
      } else if (
        marker[0] === fenceChar &&
        marker.length >= fenceLen &&
        /^[\t ]*$/.test(line.slice(fenceMatch[0].length))
      ) {
        // Closing the current fence
        fenceChar = null;
      }
      continue;
    }

    if (fenceChar) continue; // inside a fenced block, skip

    const taskMatch = TASK_ITEM_PATTERN.exec(line);
    if (!taskMatch) continue;

    total++;
    if (taskMatch[1].toLowerCase() === "x") completed++;
  }

  return { total, completed };
}
