import { GitMerge, GitPullRequest } from "lucide-react";
import type { SyntheticEvent } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import { cn } from "@/lib/cn";
import { getExternalWebUrl, openExternalWebUrl } from "@/lib/external-url";
import type { ExternalLink } from "@/types/external-link";

type PullRequest = ExternalLink & { href: string };

type PullRequestStatus = "merged" | "draft" | "open";

const statusIconClass: Record<PullRequestStatus, string> = {
  merged: "text-info-foreground",
  draft: "text-muted-foreground",
  open: "text-success-foreground",
};

function getStatus(pr: ExternalLink): PullRequestStatus {
  if (pr.metadata?.merged === true) return "merged";
  if (pr.metadata?.draft === true) return "draft";
  return "open";
}

function StatusIcon({
  status,
  className,
}: {
  status: PullRequestStatus;
  className?: string;
}) {
  const Icon = status === "merged" ? GitMerge : GitPullRequest;
  return (
    <Icon
      aria-hidden
      className={cn("size-3 shrink-0", statusIconClass[status], className)}
    />
  );
}

function getRepoName(url: string) {
  return url.match(/github\.com\/([^/]+\/[^/]+)\/pull/)?.[1] ?? null;
}

const stopPropagation = (e: SyntheticEvent) => e.stopPropagation();

type TaskPullRequestsProps = {
  externalLinks: ExternalLink[] | null | undefined;
  className?: string;
};

export function TaskPullRequests({
  externalLinks,
  className,
}: TaskPullRequestsProps) {
  const { t } = useTranslation();

  const pullRequests = useMemo(
    () =>
      (externalLinks ?? []).flatMap((link): PullRequest[] => {
        if (link.resourceType !== "pull_request") return [];
        const href = getExternalWebUrl(link.url);
        return href ? [{ ...link, href }] : [];
      }),
    [externalLinks],
  );

  if (pullRequests.length === 0) return null;

  const single = pullRequests.length === 1 ? pullRequests[0] : null;
  const summaryStatus: PullRequestStatus = pullRequests.every(
    (pr) => getStatus(pr) === "merged",
  )
    ? "merged"
    : pullRequests.some((pr) => getStatus(pr) === "open")
      ? "open"
      : "draft";

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (single) openExternalWebUrl(single.href);
          }}
          onPointerDown={stopPropagation}
          className={cn(
            "inline-flex h-5.5 items-center gap-1.5 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted",
            className,
          )}
        >
          <StatusIcon status={single ? getStatus(single) : summaryStatus} />
          <span>
            {single
              ? `#${single.externalId}`
              : t("tasks:pr.count", { count: pullRequests.length })}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-80 flex-col gap-px p-1"
        side="bottom"
        align="start"
        onClick={stopPropagation}
        onPointerDown={stopPropagation}
        onKeyDown={stopPropagation}
      >
        {pullRequests.map((pr) => {
          const status = getStatus(pr);
          const repoName = getRepoName(pr.url);
          return (
            <a
              key={pr.id}
              href={pr.href}
              target="_blank"
              rel="noopener noreferrer"
              title={repoName ? `${repoName}#${pr.externalId}` : undefined}
              className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
            >
              <StatusIcon status={status} className="size-3.5" />
              <span className="sr-only">{t(`tasks:pr.${status}`)}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">
                {pr.title || t("tasks:pr.label")}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                #{pr.externalId}
              </span>
            </a>
          );
        })}
      </HoverCardContent>
    </HoverCard>
  );
}
