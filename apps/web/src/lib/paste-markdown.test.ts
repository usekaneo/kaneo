import { Editor } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pasteMarkdown } from "./paste-markdown";

let editor: Editor;
afterEach(() => editor?.destroy());
function setup(content = "") {
  editor = new Editor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown,
    ],
    content,
    contentType: "markdown",
  });
}
function clipboard(text: string, html = "") {
  return {
    clipboardData: {
      getData: (type: string) => (type === "text/html" ? html : text),
    },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent;
}
describe("Markdown paste and edit round trips", () => {
  it.each([
    "**Provide a staff-only interface.**",
    "- [ ] **Bold task**\n- [x] *Done*",
    "# Heading\n\n**Bold** and [link](https://example.com)",
  ])("preserves formatting in %s", (markdown) => {
    setup();
    expect(pasteMarkdown(editor, clipboard(markdown))).toBe(true);
    const saved = editor.getMarkdown();
    expect(saved).not.toContain("\\*");
    expect(editor.getHTML()).toContain("<strong>");
    editor.commands.setContent(saved, { contentType: "markdown" });
    expect(editor.getMarkdown()).toBe(saved);
    expect(editor.getHTML()).toContain("<strong>");
  });
  it("inserts inline formatting inside the existing paragraph", () => {
    setup("Hello world");
    editor.commands.setTextSelection(7);
    expect(pasteMarkdown(editor, clipboard("**bold** "))).toBe(true);
    expect(editor.getHTML()).toBe("<p>Hello <strong>bold</strong> world</p>");
  });
  it.each([
    "www.youtube.com/watch?v=video",
    "youtube.com/watch?v=video",
    "www.example.com/issue/TEST-1",
  ])("leaves %s to URL handlers", (url) => {
    setup();
    const event = clipboard(url);
    expect(pasteMarkdown(editor, event)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
  it("leaves rich text, plain text and code-block pastes alone", () => {
    setup();
    expect(
      pasteMarkdown(editor, clipboard("**literal**", "<p>**literal**</p>")),
    ).toBe(false);
    expect(pasteMarkdown(editor, clipboard("plain text"))).toBe(false);
    expect(
      pasteMarkdown(editor, clipboard("https://youtube.com/watch?v=video")),
    ).toBe(false);
    editor.commands.setCodeBlock();
    expect(pasteMarkdown(editor, clipboard("**literal**"))).toBe(false);
  });
  it("does not unescape deliberately literal Markdown on load", () => {
    setup("\\*\\*literal\\*\\*");
    expect(editor.getHTML()).not.toContain("<strong>");
    expect(editor.getMarkdown()).toContain("\\*");
  });
});
