import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createBaseExtensions } from "./base-extensions";

let editor: Editor | null = null;

function createEditor(content = "") {
  editor = new Editor({
    extensions: createBaseExtensions({
      placeholder: "Write something",
    }),
    content,
  });
  return editor;
}

function typeText(instance: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = instance.state.selection;
    const handled = instance.view.someProp("handleTextInput", (fn) =>
      fn(instance.view, from, to, ch, () =>
        instance.state.tr.insertText(ch, from, to),
      ),
    );
    if (!handled) {
      instance.view.dispatch(instance.state.tr.insertText(ch, from, to));
    }
  }
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("InlineCodeInputRule", () => {
  it("formats inline code when typing `` then moving inside, typing text, moving right, and pressing Space", () => {
    const instance = createEditor();
    instance.commands.focus("end");

    // 1. Type ``
    typeText(instance, "``");
    expect(instance.getText()).toBe("``");

    // 2. Move Left between the two backticks and type "hi"
    const posAfterPair = instance.state.selection.from;
    instance.commands.setTextSelection(posAfterPair - 1);
    typeText(instance, "hi");
    expect(instance.getText()).toBe("`hi`");

    // 3. Move Right past the closing backtick and press Space
    const posInside = instance.state.selection.from;
    instance.commands.setTextSelection(posInside + 1);
    typeText(instance, " ");

    const paragraph = instance.getJSON().content?.[0];
    expect(paragraph?.content).toEqual([
      {
        type: "text",
        text: "hi",
        marks: [{ type: "code" }],
      },
      {
        type: "text",
        text: " ",
      },
    ]);
  });

  it("still formats inline code when typing closing backtick directly", () => {
    const instance = createEditor();
    instance.commands.focus("end");

    typeText(instance, "`hi`");

    const paragraph = instance.getJSON().content?.[0];
    expect(paragraph?.content).toEqual([
      {
        type: "text",
        text: "hi",
        marks: [{ type: "code" }],
      },
    ]);
  });

  it("does not format double-backtick fenced prefixes followed by space", () => {
    const instance = createEditor();
    instance.commands.focus("end");

    typeText(instance, "``hi` ");

    const paragraph = instance.getJSON().content?.[0];
    expect(paragraph?.content).toEqual([
      {
        type: "text",
        text: "``hi` ",
      },
    ]);
  });
});
