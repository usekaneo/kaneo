import { Editor } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { EditorKeymap } from "./editor-keymap";

let editor: Editor;

function build(content: object) {
  editor?.destroy();
  editor = new Editor({
    extensions: [StarterKit, TaskList, TaskItem, EditorKeymap],
    content,
  });
  editor.commands.focus("end");
  return editor;
}

function press(init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    ...init,
  });
  editor.view.dom.dispatchEvent(event);
  return event.defaultPrevented;
}

const paragraph = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

afterEach(() => editor?.destroy());

describe("EditorKeymap", () => {
  it("uses the list keys", () => {
    build(paragraph("Ship it"));

    press({ key: "7", code: "Digit7", shiftKey: true, keyCode: 55 });
    expect(editor.isActive("taskList")).toBe(true);

    press({ key: "9", code: "Digit9", shiftKey: true, keyCode: 57 });
    expect(editor.isActive("orderedList")).toBe(true);

    press({ key: "8", code: "Digit8", shiftKey: true, keyCode: 56 });
    expect(editor.isActive("bulletList")).toBe(true);
  });

  it("formats strikethrough, quotes and code blocks", () => {
    build(paragraph("Ship it"));
    editor.commands.selectAll();

    press({ key: "x", code: "KeyX", shiftKey: true, keyCode: 88 });
    expect(editor.isActive("strike")).toBe(true);

    build(paragraph("Quoted"));
    press({
      key: ".",
      code: "Period",
      ctrlKey: false,
      altKey: true,
      shiftKey: true,
      keyCode: 190,
    });
    expect(editor.getHTML()).toContain("<blockquote>");

    build(paragraph("const answer = 42"));
    press({ key: "\\", code: "Backslash", shiftKey: true, keyCode: 220 });
    expect(editor.isActive("codeBlock")).toBe(true);
  });

  it("toggles the checklist item under the cursor with Mod+Enter", () => {
    build({
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Test" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(press({ key: "Enter", code: "Enter" })).toBe(true);
    expect(editor.state.doc.firstChild?.firstChild?.attrs.checked).toBe(true);
  });

  it("passes Mod+Enter on outside checklists", () => {
    build(paragraph("Plain text"));

    press({ key: "Enter", code: "Enter" });

    expect(editor.getHTML()).toBe("<p>Plain text<br></p>");
  });
});
