import {
  AttachmentCard as AttachmentCardNode,
  isValidUrl,
} from "@kaneo/editor";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { FileText } from "lucide-react";

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

  return (
    <NodeViewWrapper as="span" className="kaneo-attachment-node">
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

export const AttachmentCard = AttachmentCardNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(AttachmentCardView);
  },
});
