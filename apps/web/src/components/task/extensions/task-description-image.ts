import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TaskDescriptionImageView } from "./task-description-image-view";

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Task description image with optional width (serialized to HTML in markdown for round-trip).
 */
export const TaskDescriptionImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width"),
        renderHTML: (attributes) => {
          if (attributes.width == null || attributes.width === "") {
            return {};
          }
          return { width: String(attributes.width) };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskDescriptionImageView);
  },

  renderMarkdown(node) {
    const src = String(node.attrs?.src ?? "");
    const alt = String(node.attrs?.alt ?? "");
    const widthRaw = node.attrs?.width;
    if (!src) {
      return "";
    }

    const width =
      widthRaw != null && String(widthRaw).trim() !== ""
        ? String(widthRaw).trim()
        : "";

    if (width) {
      return `\n<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" width="${escapeAttr(width)}" class="kaneo-editor-image" />\n`;
    }

    const safeAlt = alt.replace(/\]/g, "\\]");
    return `\n![${safeAlt}](${src})\n`;
  },
});
