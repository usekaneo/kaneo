import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Maximize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useTaskDescriptionImagePreview } from "./task-description-image-preview-context";

export function TaskDescriptionImageView({
  node,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation("tasks");
  const preview = useTaskDescriptionImagePreview();
  const src = String(node.attrs.src || "");
  const alt = String(node.attrs.alt || "");
  const widthRaw = node.attrs.width;
  const widthAttr =
    widthRaw != null && String(widthRaw).trim() !== ""
      ? String(widthRaw).trim()
      : undefined;

  const setWidth = (width: string) => {
    updateAttributes({ width });
  };

  return (
    <NodeViewWrapper
      data-drag-handle=""
      className="kaneo-task-description-image-node group/image-node relative my-2 inline-block max-w-full overflow-hidden rounded-[calc(var(--radius)-2px)] align-middle"
    >
      <img
        src={src}
        alt={alt}
        width={widthAttr}
        className="kaneo-editor-image kaneo-task-description-image-img block"
        draggable={true}
        contentEditable={false}
      />
      {preview ? (
        <button
          type="button"
          className={cn(
            "pointer-events-auto absolute top-2 right-2 z-20 flex size-8 cursor-pointer items-center justify-center rounded-lg",
            "border border-white/45 bg-zinc-950/90 text-white shadow-[0_2px_18px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.14)]",
            "backdrop-blur-md",
            "opacity-0 transition-[opacity,background-color,border-color,box-shadow,transform] duration-150",
            "group-hover/image-node:opacity-100",
            "hover:scale-105 hover:border-white/80 hover:bg-zinc-900 hover:shadow-[0_4px_22px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.18)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            preview.openImagePreview(
              src,
              alt || t("detail.editor.previewImage"),
            );
          }}
          aria-label={t("detail.editor.expandImage")}
        >
          <Maximize2
            className="size-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
            strokeWidth={2.25}
          />
        </button>
      ) : null}
      <div
        className={cn(
          "absolute bottom-2 left-1/2 z-20 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap justify-center gap-px rounded-md border border-border/80 bg-popover px-0.5 py-px text-popover-foreground shadow-md transition-opacity",
          selected
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 min-h-6 shrink-0 px-1.5 text-[10px] leading-none"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setWidth("200")}
        >
          {t("detail.editor.imageSizeS")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 min-h-6 shrink-0 px-1.5 text-[10px] leading-none"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setWidth("360")}
        >
          {t("detail.editor.imageSizeM")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 min-h-6 shrink-0 px-1.5 text-[10px] leading-none"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setWidth("520")}
        >
          {t("detail.editor.imageSizeL")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 min-h-6 shrink-0 px-1.5 text-[10px] leading-none"
          title={t("detail.editor.imageSizeFull")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setWidth("")}
        >
          {t("detail.editor.imageSizeAuto")}
        </Button>
      </div>
    </NodeViewWrapper>
  );
}
