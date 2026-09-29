import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import { cn } from "@/lib/cn";
import {
  getPullRequestStatus,
  getPullRequests,
  getPullRequestsStatus,
} from "@/lib/pull-request";
import type { ExternalLink } from "@/types/external-link";
import { PullRequestRow } from "./pull-request-row";
import { PullRequestStatusIcon } from "./pull-request-status-icon";

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
    () => getPullRequests(externalLinks),
    [externalLinks],
  );

  if (pullRequests.length === 0) return null;

  const single = pullRequests.length === 1 ? pullRequests[0] : null;
  const badgeClassName = cn(
    "inline-flex h-5.5 items-center gap-1.5 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted",
    className,
  );

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {single ? (
          <a
            href={single.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className={badgeClassName}
          >
            <PullRequestStatusIcon status={getPullRequestStatus(single)} />
            <span>#{single.externalId}</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className={badgeClassName}
          >
            <PullRequestStatusIcon
              status={getPullRequestsStatus(pullRequests)}
            />
            <span>{t("tasks:pr.count", { count: pullRequests.length })}</span>
          </button>
        )}
      </HoverCardTrigger>
      <HoverCardContent
        className="w-80 flex-col gap-px p-1"
        side="bottom"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {pullRequests.map((pr) => (
          <PullRequestRow key={pr.id} pullRequest={pr} />
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}
