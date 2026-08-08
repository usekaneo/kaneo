import Image from "@tiptap/extension-image";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import {
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { escapeHtml } from "./url-safety";

const MIN_WIDTH = 80;

const SIZE_PRESETS = [
  { key: "small", label: "tasks:detail.editor.image.small", fraction: 0.25 },
  { key: "medium", label: "tasks:detail.editor.image.medium", fraction: 0.5 },
  { key: "large", label: "tasks:detail.editor.image.large", fraction: 1 },
] as const;

function parseWidth(value: unknown) {
  const width = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(width) && width > 0 ? width : null;
}

function ResizableImageNodeView({
  editor,
  node,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation();
  const imageRef = useRef<HTMLImageElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const width = parseWidth(node.attrs.width);
  const isEditable = editor.isEditable;

  const maxWidth = () => editor.view.dom.clientWidth || MIN_WIDTH;

  const clamp = (value: number) =>
    Math.round(Math.min(Math.max(value, MIN_WIDTH), maxWidth()));

  const handleResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isEditable) return;
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = imageRef.current?.getBoundingClientRect().width ?? 0;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setIsResizing(true);

    const handleMove = (moveEvent: PointerEvent) => {
      updateAttributes({
        width: clamp(startWidth + moveEvent.clientX - startX),
      });
    };

    const handleEnd = () => {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", handleMove);
      handle.removeEventListener("pointerup", handleEnd);
      handle.removeEventListener("pointercancel", handleEnd);
      setIsResizing(false);
    };

    handle.addEventListener("pointermove", handleMove);
    handle.addEventListener("pointerup", handleEnd);
    handle.addEventListener("pointercancel", handleEnd);
  };

  return (
    <NodeViewWrapper
      as="span"
      className="kaneo-resizable-image"
      data-resized={width ? "true" : "false"}
    >
      <img
        ref={imageRef}
        src={node.attrs.src}
        alt={node.attrs.alt || ""}
        title={node.attrs.title || undefined}
        width={width ?? undefined}
        // The stylesheet sets `width: auto` on editor images, so the width
        // attribute alone would not survive into the rendered size.
        style={width ? { width: `${width}px` } : undefined}
        loading="lazy"
        className="kaneo-editor-image"
      />

      {isEditable && (
        <span
          className="kaneo-resizable-image-controls"
          contentEditable={false}
        >
          {SIZE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() =>
                updateAttributes({ width: clamp(maxWidth() * preset.fraction) })
              }
            >
              {t(preset.label)}
            </button>
          ))}
          <button
            type="button"
            disabled={!width}
            onClick={() => updateAttributes({ width: null })}
          >
            {t("tasks:detail.editor.image.reset")}
          </button>
        </span>
      )}

      {isEditable && (
        <button
          type="button"
          aria-label={t("tasks:detail.editor.image.resizeHandle")}
          className={cn(
            "kaneo-resizable-image-handle",
            isResizing && "kaneo-resizable-image-handle-active",
          )}
          onPointerDown={handleResizeStart}
        />
      )}
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const styleWidth = element.style.width;
          return parseWidth(
            element.getAttribute("width") ??
              // Only pixel widths are portable; a percentage would otherwise
              // be misread as a pixel count.
              (styleWidth.endsWith("px") ? styleWidth.slice(0, -2) : null),
          );
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const width = parseWidth(attributes.width);
          return width ? { width } : {};
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
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
      return `![${alt}](${src}${title ? ` "${title}"` : ""})`;
    }

    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${
      title ? ` title="${escapeHtml(title)}"` : ""
    } width="${width}" />`;
  },
});
