import { Play } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLinkPreview } from "@/hooks/queries/use-link-preview";
import { cn } from "@/lib/cn";
import type { TextPart } from "@/lib/linkify";

const LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer nofollow",
} as const;

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** A card under a chat message: site, title, summary and picture. */
export function LinkPreviewCard({
  workspaceId,
  url,
}: {
  workspaceId: string | undefined;
  url: string;
}) {
  const { t } = useTranslation();
  const { data: preview, isLoading } = useLinkPreview(workspaceId, url);
  const [imageFailed, setImageFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  if (isLoading) {
    return (
      <div className="mt-1.5 h-20 w-full max-w-md animate-pulse rounded-lg border border-border border-s-4 border-s-muted bg-muted/30" />
    );
  }
  if (!preview) return null;

  const site = preview.siteName ?? hostOf(preview.url);
  const image = imageFailed ? null : preview.image;
  const video = preview.youtubeId;

  const header = (
    <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
      {preview.favicon && !iconFailed && (
        <img
          src={preview.favicon}
          alt=""
          className="size-3.5 shrink-0 rounded-sm"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setIconFailed(true)}
        />
      )}
      <span className="truncate">{site}</span>
    </div>
  );

  const title = preview.title && (
    <a
      href={preview.url}
      {...LINK_PROPS}
      className="line-clamp-2 font-semibold text-sm text-sky-600 leading-snug hover:underline dark:text-sky-400"
    >
      {preview.title}
    </a>
  );

  if (video) {
    return (
      <div className="mt-1.5 w-full max-w-md overflow-hidden rounded-lg border border-border border-s-4 border-s-red-500 bg-card">
        <div className="space-y-1 px-3 pt-2.5 pb-2">
          {header}
          {title}
          {preview.description && (
            <p className="truncate text-muted-foreground text-xs">
              {preview.description}
            </p>
          )}
        </div>
        <div className="relative aspect-video w-full bg-black">
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video}?autoplay=1&rel=0`}
              title={preview.title ?? site}
              className="absolute inset-0 size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={t("chat:preview.play", {
                title: preview.title ?? site,
              })}
              className="group/play absolute inset-0 size-full"
            >
              {image && (
                <img
                  src={image}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover/play:bg-black/25">
                <span className="flex h-11 w-16 items-center justify-center rounded-xl bg-red-600 shadow-lg transition-transform group-hover/play:scale-110">
                  <Play className="size-5 fill-white text-white" />
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-1.5 flex w-full max-w-md gap-3 overflow-hidden rounded-lg border border-border border-s-4 border-s-primary/60 bg-card p-3",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {header}
        {title}
        {preview.description && (
          <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
            {preview.description}
          </p>
        )}
      </div>
      {image && (
        <img
          src={image}
          alt=""
          className="size-20 shrink-0 rounded-md object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}

/** Message text with http(s) links made clickable; the rest stays text. */
export function LinkedText({ parts }: { parts: TextPart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.type === "link" ? (
          <a
            // biome-ignore lint/suspicious/noArrayIndexKey: parts never reorder
            key={index}
            href={part.href}
            {...LINK_PROPS}
            className="break-all text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
          >
            {part.value}
          </a>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts never reorder
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  );
}
