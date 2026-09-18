import { Link2, Play } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { TaskAttachment } from "@/fetchers/task-attachment";
import { useLinkPreview } from "@/hooks/queries/use-link-preview";
import { formatDateMedium } from "@/lib/format";

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

/**
 * A link on a task, shown like a chat link preview: the site's icon, the
 * page's title and summary, and its picture. The stored title wins (typed by
 * hand, or the page title saved when the link was added); older links that
 * only have their host name as a title pick up the page title here.
 */
export default function TaskLinkAttachment({
  attachment,
  workspaceId,
  action,
}: {
  attachment: TaskAttachment;
  workspaceId: string;
  action?: ReactNode;
}) {
  const url = attachment.url ?? "";
  const { data: preview } = useLinkPreview(workspaceId, url);
  const [iconFailed, setIconFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const host = hostOf(url);
  const storedIsJustHost =
    attachment.title === host || attachment.title === `www.${host}`;
  const title =
    storedIsJustHost && preview?.title ? preview.title : attachment.title;
  const image = preview?.image && !imageFailed ? preview.image : null;

  return (
    <li className="group flex items-center gap-3 py-2 text-sm">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {preview?.favicon && !iconFailed ? (
          <img
            src={preview.favicon}
            alt=""
            className="size-4"
            referrerPolicy="no-referrer"
            onError={() => setIconFailed(true)}
          />
        ) : (
          <Link2 className="size-4 text-muted-foreground" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={url}
          {...LINK_PROPS}
          className="block truncate font-medium hover:underline"
          title={title}
        >
          {title}
        </a>
        {preview?.description && (
          <p className="truncate text-muted-foreground text-xs">
            {preview.description}
          </p>
        )}
        <p className="truncate text-muted-foreground/80 text-xs">
          {[
            preview?.siteName ?? host,
            attachment.createdByName,
            formatDateMedium(attachment.createdAt),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {image && (
        // Decorative: the title above is the link.
        <span className="relative hidden h-12 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:block">
          <img
            src={image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
          {preview?.youtubeId && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
                <Play className="size-3 fill-current" />
              </span>
            </span>
          )}
        </span>
      )}
      {action}
    </li>
  );
}
