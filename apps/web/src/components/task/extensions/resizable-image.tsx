import Image from "@tiptap/extension-image";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  escapeHtml,
  escapeMarkdownText,
  escapeMarkdownTitle,
  formatMarkdownUrl,
} from "./url-safety";

const MIN_WIDTH = 80;
const RESIZE_STEP = 16;

const SIZE_PRESETS = [
  { key: "small", label: "tasks:detail.editor.image.small", fraction: 0.25 },
  { key: "medium", label: "tasks:detail.editor.image.medium", fraction: 0.5 },
  { key: "large", label: "tasks:detail.editor.image.large", fraction: 1 },
] as const;

function parseWidth(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  // `Number.parseInt` stops at the first non-digit and discards the rest, so it
  // would read `50%` as 50 pixels. Match the whole value instead, so only a
  // pixel count gets through and every other unit is rejected.
  const match = /^(\d+)(?:px)?$/i.exec(String(value ?? "").trim());
  if (!match) return null;

  const width = Number.parseInt(match[1], 10);
  return width > 0 ? width : null;
}

function ResizableImageNodeView({
  editor,
  node,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation();
  const imageRef = useRef<HTMLImageElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  // Width previewed mid-drag. Committing on every `pointermove` would run a
  // ProseMirror transaction — and the full-document markdown re-serialization in
  // `TaskDescription.onUpdate` — at pointer-event frequency.
  const [draftWidth, setDraftWidth] = useState<number | null>(null);
  const draftWidthRef = useRef<number | null>(null);
  const width = draftWidth ?? parseWidth(node.attrs.width);
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
      const next = clamp(startWidth + moveEvent.clientX - startX);
      draftWidthRef.current = next;
      setDraftWidth(next);
    };

    const handleEnd = () => {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", handleMove);
      handle.removeEventListener("pointerup", handleEnd);
      handle.removeEventListener("pointercancel", handleEnd);
      setIsResizing(false);

      // One transaction per gesture, so a single undo reverses the whole drag.
      const resizedTo = draftWidthRef.current;
      draftWidthRef.current = null;
      setDraftWidth(null);
      if (resizedTo !== null) updateAttributes({ width: resizedTo });
    };

    handle.addEventListener("pointermove", handleMove);
    handle.addEventListener("pointerup", handleEnd);
    handle.addEventListener("pointercancel", handleEnd);
  };

  const handleResizeKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!isEditable) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();

    const current =
      width ??
      Math.round(imageRef.current?.getBoundingClientRect().width ?? MIN_WIDTH);
    const step = event.shiftKey ? RESIZE_STEP * 4 : RESIZE_STEP;

    updateAttributes({
      width: clamp(current + (event.key === "ArrowLeft" ? -step : step)),
    });
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
          onKeyDown={handleResizeKeyDown}
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
