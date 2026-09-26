import type { Editor } from "@tiptap/core";

export function pasteMarkdown(editor: Editor, event: ClipboardEvent): boolean {
  const clipboard = event.clipboardData;
  // Rich clipboard content and code blocks retain their native paste behavior.
  if (
    !editor.isEditable ||
    !clipboard ||
    clipboard.getData("text/html") ||
    editor.isActive("codeBlock")
  ) {
    return false;
  }
  const text = clipboard.getData("text/plain");
  if (!text || !editor.markdown) return false;
  // Leave single URLs to the issue-link and video-embed paste handlers.
  if (/^https?:\/\/\S+$/i.test(text.trim())) return false;
  const document = editor.markdown.parse(text);
  const hasFormatting = (nodes: typeof document.content): boolean =>
    (nodes ?? []).some(
      (node) =>
        (node.type !== "paragraph" &&
          node.type !== "text" &&
          node.type !== "hardBreak") ||
        Boolean(node.marks?.length) ||
        hasFormatting(node.content),
    );
  if (!hasFormatting(document.content)) return false;
  event.preventDefault();
  editor.commands.insertContent(document.content ?? []);
  return true;
}
