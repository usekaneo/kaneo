import Image from "@tiptap/extension-image";
import { parseWidth } from "./parse-width";
import {
  escapeHtml,
  escapeMarkdownText,
  escapeMarkdownTitle,
  formatMarkdownUrl,
} from "./url-safety";

export const KaneoImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          // `parseWidth` rejects every unit but `px`, so both raw values can go
          // straight in. Reading them independently also stops an unusable
          // `width="50%"` from shadowing a usable inline `width: 320px`.
          parseWidth(element.getAttribute("width")) ??
          parseWidth(element.style.width),
        renderHTML: (attributes: Record<string, unknown>) => {
          const width = parseWidth(attributes.width);
          return width ? { width } : {};
        },
      },
    };
  },

  renderMarkdown(
    node: {
      attrs?: { src?: string; alt?: string; title?: string; width?: number };
    },
    _helpers: unknown,
    _context: unknown,
  ) {
    const src = String(node.attrs?.src || "");
    const alt = String(node.attrs?.alt || "");
    const title = String(node.attrs?.title || "");
    const width = parseWidth(node.attrs?.width);

    if (!src) return "";

    // Standard markdown has nowhere to carry a width, so a resized image is
    // written as HTML — which the markdown pipeline round-trips intact.
    if (!width) {
      const markdownTitle = title ? ` "${escapeMarkdownTitle(title)}"` : "";
      return `![${escapeMarkdownText(alt)}](${formatMarkdownUrl(
        src,
      )}${markdownTitle})`;
    }

    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${
      title ? ` title="${escapeHtml(title)}"` : ""
    } width="${width}" />`;
  },
});
