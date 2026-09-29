import type { SyntheticEvent } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import { cn } from "@/lib/cn";
import { openExternalWebUrl } from "@/lib/external-url";
import {
  getPullRequestStatus,
  getPullRequests,
  getPullRequestsStatus,
} from "@/lib/pull-request";
import type { ExternalLink } from "@/types/external-link";
import { PullRequestRow } from "./pull-request-row";
import { PullRequestStatusIcon } from "./pull-request-status-icon";

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
    () => getPullRequests(externalLinks),
    [externalLinks],
  );

  if (pullRequests.length === 0) return null;

  const single = pullRequests.length === 1 ? pullRequests[0] : null;

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
          <PullRequestStatusIcon
            status={
              single
                ? getPullRequestStatus(single)
                : getPullRequestsStatus(pullRequests)
            }
          />
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
        {pullRequests.map((pr) => (
          <PullRequestRow key={pr.id} pullRequest={pr} />
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}
