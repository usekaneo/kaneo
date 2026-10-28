import { Editor } from "@tiptap/core";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import { EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { TaskItemWithCheckbox } from "./task-item-with-checkbox";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let editor: Editor;

afterEach(() => {
  cleanup();
  editor?.destroy();
  vi.restoreAllMocks();
});

it.each([
  ["Android", "Mozilla/5.0 (Linux; Android 14) Chrome/130.0.0.0 Mobile"],
  ["iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"],
])(
  "continues a checklist through %s virtual-keyboard Enter",
  async (_device, userAgent) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
    editor = new Editor({
      extensions: [
        StarterKit.configure({ trailingNode: false }),
        TaskList,
        TaskItemWithCheckbox.configure({ nested: true }),
        Markdown,
      ],
      content: "- [ ] First",
      contentType: "markdown",
    });
    render(<EditorContent editor={editor} />);
    await act(async () => {});
    act(() => {
      editor.commands.setTextSelection(8);
      editor.view.focus();
    });

    const event = new InputEvent("beforeinput", {
      inputType: "insertParagraph",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      editor.view.dom.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(editor.state.doc.firstChild?.childCount).toBe(2);
    expect(editor.state.selection.$from.parent.textContent).toBe("");

    act(() => {
      editor.commands.insertContent("Second");
    });
    expect(editor.getMarkdown()).toBe("- [ ] First\n- [ ] Second");
  },
);
