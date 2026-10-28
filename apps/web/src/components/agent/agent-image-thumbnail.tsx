import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

type AgentImageThumbnailProps = {
  name: string;
  src: string | null;
  size?: "sm" | "md";
  uploading?: boolean;
  onPreview?: () => void;
  onRemove?: () => void;
};

export function AgentImageThumbnail({
  name,
  src,
  size = "sm",
  uploading = false,
  onPreview,
  onRemove,
}: AgentImageThumbnailProps) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        "group relative inline-flex shrink-0 overflow-hidden rounded-md border border-border/80 bg-muted",
        size === "sm" ? "size-12" : "size-20",
      )}
    >
      <button
        type="button"
        className="size-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={t("agent:composer.previewAttachment", { name })}
        disabled={!src || !onPreview}
        onClick={onPreview}
      >
        {src && (
          <img
            src={src}
            alt={name}
            loading="lazy"
            className={cn("size-full object-cover", uploading && "opacity-50")}
          />
        )}
      </button>
      {uploading && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner
            aria-label={t("agent:composer.uploading", { name })}
            className="size-4 text-foreground"
          />
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-xs hover:text-foreground"
          aria-label={t("agent:composer.removeAttachment", { name })}
          onClick={onRemove}
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      )}
    </span>
  );
}
