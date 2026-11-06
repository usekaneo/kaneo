import { mergeAttributes, Node } from "@tiptap/core";
import { escapeHtml } from "./url-safety";

export const KaneoIssueLink = Node.create({
  name: "kaneoIssueLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      url: { default: "" },
      issueKey: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("issue-key") ??
          element.getAttribute("data-issue-key") ??
          element.getAttribute("issuekey") ??
          "",
      },
      taskId: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("task-id") ??
          element.getAttribute("data-task-id") ??
          element.getAttribute("taskid") ??
          "",
      },
    };
  },

  parseHTML() {
    return [
      { tag: "kaneo-issue-link[url]" },
      { tag: "span[data-type='kaneo-issue-link'][data-url]" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "kaneo-issue-link",
      mergeAttributes(HTMLAttributes, {
        "data-type": "kaneo-issue-link",
        "data-url": HTMLAttributes.url,
        "data-issue-key": HTMLAttributes.issueKey,
        "data-task-id": HTMLAttributes.taskId,
        url: HTMLAttributes.url,
        "issue-key": HTMLAttributes.issueKey,
        "task-id": HTMLAttributes.taskId,
      }),
    ];
  },

  renderMarkdown(
    node: { attrs?: { url?: string; issueKey?: string; taskId?: string } },
    _helpers: unknown,
    _context: unknown,
  ) {
    const url = String(node.attrs?.url || "");
    const issueKey = String(node.attrs?.issueKey || "");
    const taskId = String(node.attrs?.taskId || "");
    if (!url) return "";
    return `\n<kaneo-issue-link url="${escapeHtml(url)}" issue-key="${escapeHtml(issueKey)}" task-id="${escapeHtml(taskId)}" />\n`;
  },
});
