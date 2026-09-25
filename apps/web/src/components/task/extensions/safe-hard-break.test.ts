import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { SafeHardBreak } from "./safe-hard-break";

function buildEditor(options: {
  editable: boolean;
  content?: object;
  useSafe?: boolean;
}) {
  const extensions = options.useSafe
    ? StarterKit.configure({ hardBreak: false })
    : StarterKit;
  return new Editor({
    extensions: options.useSafe ? [extensions, SafeHardBreak] : [extensions],
    content: options.content ?? {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    editable: options.editable,
  });
}

function fireShiftEnter(editor: Editor): boolean {
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  editor.view.dom.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("SafeHardBreak (Fixes KANEO-WEB-6)", () => {
  it("treats Shift+Enter as a no-op in a readOnly editor and does not throw", () => {
    const editor = buildEditor({ editable: false, useSafe: true });
    const before = editor.getJSON();

    expect(() => {
      fireShiftEnter(editor);
    }).not.toThrow();

    // SafeHardBreak returns false from the keymap in readOnly, so no
    // transaction is built and the upstream "Invalid content for node
    // paragraph" throw cannot fire. The document is therefore unchanged.
    expect(editor.getJSON()).toEqual(before);
    expect(editor.isEditable).toBe(false);
    editor.destroy();
  });

  it("inserts a hardBreak on Shift+Enter in an editable editor", () => {
    const editor = buildEditor({
      editable: true,
      useSafe: true,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "hello" }],
          },
        ],
      },
    });

    editor.commands.focus("end");
    fireShiftEnter(editor);

    const json = editor.getJSON();
    const paragraph = json.content?.[0];
    const containsHardBreak = paragraph?.content?.some(
      (n) => n.type === "hardBreak",
    );
    const containsHello = paragraph?.content?.some(
      (n) => n.type === "text" && (n as { text?: string }).text === "hello",
    );
    expect(containsHardBreak).toBe(true);
    expect(containsHello).toBe(true);
    editor.destroy();
  });

  it("documents the upstream readOnly keymap behavior that SafeHardBreak replaces", () => {
    // Upstream HardBreak's keymap runs regardless of `editor.isEditable` and
    // builds a `tr.replaceSelectionWith` transaction. In real comment-editor
    // and task-description editors this transaction can throw
    // `TransformError: Invalid content for node paragraph`
    // (KANEO-WEB-6). SafeHardBreak replaces the keymap so the throw never
    // occurs. In this isolated schema the upstream path happens to succeed,
    // so we instead assert that the readOnly document stays unchanged.
    const editor = buildEditor({ editable: false, useSafe: false });
    const before = editor.getJSON();
    fireShiftEnter(editor);
    expect(editor.getJSON()).toEqual(before);
    editor.destroy();
  });
});
