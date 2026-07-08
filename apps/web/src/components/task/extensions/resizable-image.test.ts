import { Editor } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { ResizableImage } from "./resizable-image";

type JSONNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
};

const SRC = "https://example.com/diagram.png";

function createEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      Markdown.configure({ markedOptions: { breaks: true, gfm: true } }),
      ResizableImage.configure({
        resize: {
          enabled: true,
          alwaysPreserveAspectRatio: true,
          minWidth: 80,
          minHeight: 80,
        },
        HTMLAttributes: { class: "kaneo-editor-image", loading: "lazy" },
      }),
    ],
    content: "",
  });
}

function findImage(node: JSONNode): JSONNode | null {
  if (node.type === "image") return node;
  for (const child of node.content ?? []) {
    const found = findImage(child);
    if (found) return found;
  }
  return null;
}

describe("ResizableImage markdown persistence", () => {
  it("keeps an unresized image as plain markdown", () => {
    const editor = createEditor();
    editor.commands.setContent(`![Diagram](${SRC})`, {
      contentType: "markdown",
    });

    const markdown = editor.getMarkdown();
    expect(markdown).toContain(`![Diagram](${SRC})`);
    expect(markdown).not.toContain("<img");

    editor.destroy();
  });

  it("serializes a resized image as an <img> tag carrying the size", () => {
    const editor = createEditor();
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: SRC, alt: "Diagram", width: 640, height: 360 },
        },
      ],
    });

    const markdown = editor.getMarkdown();
    expect(markdown).toContain("<img");
    expect(markdown).toContain(`src="${SRC}"`);
    expect(markdown).toContain('width="640"');
    expect(markdown).toContain('height="360"');

    editor.destroy();
  });

  it("restores the size when a resized image round-trips through markdown", () => {
    const editor = createEditor();
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: SRC, alt: "Diagram", width: 640, height: 360 },
        },
      ],
    });

    // Reload from the serialized markdown, exactly like the task view does.
    const markdown = editor.getMarkdown();
    editor.commands.setContent(markdown, { contentType: "markdown" });

    const image = findImage(editor.getJSON() as JSONNode);
    expect(image).not.toBeNull();
    expect(String(image?.attrs?.width)).toBe("640");
    expect(String(image?.attrs?.height)).toBe("360");

    // Serializing the reloaded document is stable.
    expect(editor.getMarkdown()).toContain('width="640"');

    editor.destroy();
  });

  it("round-trips an alt that plain markdown can't represent", () => {
    const editor = createEditor();
    // Filename-derived alt text can contain brackets, which would break the
    // `![alt](src)` form; it must fall back to HTML and survive a reload.
    editor.commands.setContent({
      type: "doc",
      content: [
        { type: "image", attrs: { src: SRC, alt: "screenshot [final]" } },
      ],
    });

    const markdown = editor.getMarkdown();
    expect(markdown).toContain("<img");
    expect(markdown).toContain('alt="screenshot [final]"');

    editor.commands.setContent(markdown, { contentType: "markdown" });
    const image = findImage(editor.getJSON() as JSONNode);
    expect(image?.attrs?.alt).toBe("screenshot [final]");

    editor.destroy();
  });
});
