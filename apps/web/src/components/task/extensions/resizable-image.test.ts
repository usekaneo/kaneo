import { Editor } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { ResizableImage } from "./resizable-image";

const SRC = "https://kaneo.app/diagram.png";

let editor: Editor | null = null;

function createEditor() {
  editor = new Editor({
    extensions: [
      StarterKit,
      Markdown.configure({ markedOptions: { breaks: true, gfm: true } }),
      ResizableImage,
    ],
    content: "",
  });

  return editor;
}

function setImage(instance: Editor, attrs: Record<string, unknown>) {
  instance.commands.setContent({
    type: "doc",
    content: [{ type: "image", attrs: { src: SRC, ...attrs } }],
  });
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("ResizableImage", () => {
  it("keeps an unresized image as plain markdown", () => {
    const instance = createEditor();
    setImage(instance, { alt: "Diagram" });

    const markdown = instance.getMarkdown();

    expect(markdown).toContain(`![Diagram](${SRC})`);
    expect(markdown).not.toContain("<img");
  });

  it("serializes a resized image as html so the width survives", () => {
    const instance = createEditor();
    setImage(instance, { alt: "Diagram", width: 640 });

    const markdown = instance.getMarkdown();

    expect(markdown).toContain("<img");
    expect(markdown).toContain(`src="${SRC}"`);
    expect(markdown).toContain('width="640"');
  });

  it("restores the width when a resized image round-trips through markdown", () => {
    const instance = createEditor();
    setImage(instance, { alt: "Diagram", width: 640 });

    // Reload from the serialized markdown, exactly like the task view does.
    instance.commands.setContent(instance.getMarkdown(), {
      contentType: "markdown",
    });

    const image = instance.getJSON().content?.[0];

    expect(image?.attrs?.src).toBe(SRC);
    expect(image?.attrs?.width).toBe(640);
  });

  it("escapes html-unsafe values when serializing a resized image", () => {
    const instance = createEditor();
    setImage(instance, { alt: '"><script>alert(1)</script>', width: 320 });

    const markdown = instance.getMarkdown();

    expect(markdown).not.toContain("<script>");
    expect(markdown).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("reads a width back off plain html", () => {
    const instance = createEditor();
    instance.commands.setContent(
      `<img src="${SRC}" alt="Diagram" width="240">`,
    );

    expect(instance.getJSON().content?.[0]?.attrs?.width).toBe(240);
  });

  it("reads a pixel width off an inline style", () => {
    const instance = createEditor();
    instance.commands.setContent(`<img src="${SRC}" style="width: 320px">`);

    expect(instance.getJSON().content?.[0]?.attrs?.width).toBe(320);
  });

  it("ignores a percentage width, which is not a pixel count", () => {
    const instance = createEditor();
    instance.commands.setContent(`<img src="${SRC}" style="width: 50%">`);

    expect(instance.getJSON().content?.[0]?.attrs?.width).toBeNull();
  });

  it("ignores a non-positive width", () => {
    const instance = createEditor();
    instance.commands.setContent(`<img src="${SRC}" alt="Diagram" width="0">`);

    expect(instance.getJSON().content?.[0]?.attrs?.width).toBeNull();
  });
});
