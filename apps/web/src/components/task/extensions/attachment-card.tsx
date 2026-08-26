import { mergeAttributes, Node } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Download, FileText } from "lucide-react";
import { escapeHtml, isValidUrl } from "./url-safety";

const embeddableVideoMimeTypes = new Set([
  "video/mp4",
  "video/avi",
  "video/msvideo",
  "video/x-msvideo",
]);

export function isEmbeddableVideoMimeType(mimeType: string) {
  return embeddableVideoMimeTypes.has(
    mimeType.toLowerCase().split(";", 1)[0]?.trim() ?? "",
  );
}

export function isEmbeddableVideoAttachment(
  mimeType: string,
  filename: string,
  url: string,
) {
  if (isEmbeddableVideoMimeType(mimeType)) return true;

  return [filename, url].some((value) =>
    value.split(/[?#]/, 1)[0]?.toLowerCase().endsWith(".mp4"),
  );
}

export function parseAttachmentMimeType(element: HTMLElement) {
  return (
    element.getAttribute("mime-type") ||
    element.getAttribute("data-mime-type") ||
    ""
  );
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function AttachmentCardView({ node }: NodeViewProps) {
  const rawUrl = String(node.attrs.url || "");
  const url = isValidUrl(rawUrl) ? rawUrl : "";
  const filename = String(node.attrs.filename || "Attachment");
  const mimeType = String(node.attrs.mimeType || "");
  const size = Number(node.attrs.size || 0);

  if (url && isEmbeddableVideoAttachment(mimeType, filename, url)) {
    return (
      <NodeViewWrapper as="div" className="kaneo-video-attachment">
        {/* biome-ignore lint/a11y/useMediaCaption: uploaded attachments do not include a separate captions track. */}
        <video className="kaneo-video-player" controls preload="metadata">
          <source src={url} type={mimeType || "video/mp4"} />
          <a href={url} target="_blank" rel="noopener noreferrer">
            {filename}
          </a>
        </video>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="kaneo-video-download"
          title={filename}
        >
          <span className="kaneo-attachment-title">{filename}</span>
          <span className="kaneo-attachment-meta">
            {formatBytes(size)}
            {mimeType ? ` · ${mimeType}` : ""}
          </span>
          <Download className="size-4" aria-hidden="true" />
        </a>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="kaneo-attachment-node">
      <a
        href={url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="kaneo-attachment-card"
        title={filename}
      >
        <span className="kaneo-attachment-card-icon">
          <FileText className="size-4" />
        </span>
        <span className="kaneo-attachment-card-content">
          <span className="kaneo-attachment-card-title">{filename}</span>
          <span className="kaneo-attachment-card-meta">
            {formatBytes(size)}
            {mimeType ? ` · ${mimeType}` : ""}
          </span>
        </span>
      </a>
    </NodeViewWrapper>
  );
}

export const AttachmentCard = Node.create({
  name: "attachmentCard",
  group: "block",
  inline: false,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      url: { default: "" },
      filename: { default: "" },
      mimeType: {
        default: "",
        parseHTML: parseAttachmentMimeType,
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

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentCardView);
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
