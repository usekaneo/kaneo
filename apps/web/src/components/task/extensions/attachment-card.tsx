import { mergeAttributes, Node } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { FileText } from "lucide-react";
import { useCallback, useState } from "react";
import { getApiUrl } from "@/fetchers/get-api-url";
import { toast } from "@/lib/toast";

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function normalizeAttachmentUrl(url: string) {
  if (!url || typeof window === "undefined") {
    return url;
  }

  try {
    const parsedUrl = new URL(url, window.location.origin);

    if (
      window.location.protocol !== "https:" ||
      parsedUrl.protocol !== "http:"
    ) {
      return parsedUrl.toString();
    }

    const apiUrl = new URL(getApiUrl("/"));

    if (parsedUrl.hostname === apiUrl.hostname) {
      parsedUrl.protocol = "https:";
    }

    return parsedUrl.toString();
  } catch {
    return url;
  }
}

function AttachmentCardView({ node }: NodeViewProps) {
  const url = String(node.attrs.url || "");
  const filename = String(node.attrs.filename || "Attachment");
  const mimeType = String(node.attrs.mimeType || "");
  const size = Number(node.attrs.size || 0);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadUrl = normalizeAttachmentUrl(url);

  const handleDownload = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      if (!downloadUrl || isDownloading) {
        return;
      }

      setIsDownloading(true);

      try {
        const response = await fetch(downloadUrl, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Download failed with status ${response.status}`);
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = filename || "attachment";
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.setTimeout(() => {
          window.URL.revokeObjectURL(objectUrl);
        }, 1000);
      } catch (error) {
        console.error("Failed to download attachment:", error);
        toast.error("Could not download this attachment");
      } finally {
        setIsDownloading(false);
      }
    },
    [downloadUrl, filename, isDownloading],
  );

  return (
    <NodeViewWrapper as="span" className="kaneo-attachment-node">
      <a
        href={downloadUrl}
        className="kaneo-attachment-card"
        title={
          isDownloading ? `Downloading ${filename}` : `Download ${filename}`
        }
        onClick={handleDownload}
        aria-busy={isDownloading}
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
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      url: { default: "" },
      filename: { default: "" },
      mimeType: { default: "" },
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

    return `\n<kaneo-attachment url="${url}" filename="${filename}" mime-type="${mimeType}" size="${size}" />\n`;
  },
});
