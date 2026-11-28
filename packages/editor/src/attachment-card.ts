import { mergeAttributes, Node } from "@tiptap/core";
import { escapeHtml } from "./url-safety";

export const AttachmentCard = Node.create({
  name: "attachmentCard",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      url: { default: "" },
      filename: { default: "" },
      mimeType: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("mime-type") ??
          element.getAttribute("data-mime-type") ??
          element.getAttribute("mimetype") ??
          "",
      },
      size: { default: 0 },
    };
  },

  parseHTML() {
    return [
      { tag: "kaneo-attachment[url]" },
      { tag: "span[data-type='attachment-card'][data-url]" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "kaneo-attachment",
      mergeAttributes(HTMLAttributes, {
        "data-type": "attachment-card",
        "data-url": HTMLAttributes.url,
        "data-filename": HTMLAttributes.filename,
        "data-mime-type": HTMLAttributes.mimeType,
        "data-size": HTMLAttributes.size,
        url: HTMLAttributes.url,
      }),
    ];
  },

  renderMarkdown(
    node: {
      attrs?: {
        url?: string;
        filename?: string;
        mimeType?: string;
        size?: number;
      };
    },
    _helpers: unknown,
    _context: unknown,
  ) {
    const url = String(node.attrs?.url || "");
    const filename = String(node.attrs?.filename || "");
    const mimeType = String(node.attrs?.mimeType || "");
    const size = Number(node.attrs?.size || 0);

    if (!url) return "";

    return `\n<kaneo-attachment url="${escapeHtml(url)}" filename="${escapeHtml(filename)}" mime-type="${escapeHtml(mimeType)}" size="${size}" />\n`;
  },
});
