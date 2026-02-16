import { GitMerge, GitPullRequest } from "lucide-react";
import { useMemo } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import type { ExternalLink } from "@/types/external-link";

type PublicPRBadgeProps = {
  externalLinks: ExternalLink[];
};

export function PublicPRBadge({ externalLinks }: PublicPRBadgeProps) {
  const pullRequests = useMemo(() => {
    if (!externalLinks) return [];
    return externalLinks.filter((link) => link.resourceType === "pull_request");
  }, [externalLinks]);

  if (pullRequests.length === 0) return null;

  const getPRInfo = (pr: (typeof pullRequests)[number]) => {
    const isMerged = pr.metadata?.merged === true;
    const isDraft = pr.metadata?.draft === true;

    if (isMerged) {
      return {
        icon: <GitMerge className="h-3 w-3 text-info-foreground" />,
        status: "Merged",
        statusClass: "text-info-foreground",
      };
    }

    if (isDraft) {
      return {
        icon: <GitPullRequest className="h-3 w-3 text-muted-foreground" />,
        status: "Draft",
        statusClass: "text-muted-foreground",
      };
    }

    return {
      icon: <GitPullRequest className="h-3 w-3 text-success-foreground" />,
      status: "Open",
      statusClass: "text-success-foreground",
    };
  };

  if (pullRequests.length === 1) {
    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(pullRequests[0].url, "_blank");
            }}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-sidebar text-[10px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            {getPRInfo(pullRequests[0]).icon}
            <span>#{pullRequests[0].externalId}</span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          className="w-72 p-3"
          side="bottom"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {getPRInfo(pullRequests[0]).icon}
              <span>{getPRInfo(pullRequests[0]).status}</span>
              <span className="text-muted-foreground/50">•</span>
              <span>#{pullRequests[0].externalId}</span>
            </div>
            <p className="text-sm font-medium leading-snug">
              {pullRequests[0].title || "Pull Request"}
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  if (pullRequests.length > 1) {
    const hasOpen = pullRequests.some(
      (pr) => !pr.metadata?.merged && !pr.metadata?.draft,
    );
    const allMerged = pullRequests.every((pr) => pr.metadata?.merged);
    const iconColor = allMerged
      ? "text-info-foreground"
      : hasOpen
        ? "text-success-foreground"
        : "text-muted-foreground";

    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-sidebar text-[10px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <GitPullRequest className={`h-3 w-3 ${iconColor}`} />
            <span>{pullRequests.length} PRs</span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          className="w-auto min-w-56 max-w-96 p-1"
          side="bottom"
          onClick={(e) => e.stopPropagation()}
        >
          {pullRequests.map((pr, index) => {
            const prInfo = getPRInfo(pr);
            const repoMatch = pr.url.match(/github\.com\/([^/]+\/[^/]+)\/pull/);
            const repoName = repoMatch ? repoMatch[1] : null;
            return (
              <div key={pr.id}>
                {index > 0 && <hr className="border-border my-1" />}
                <button
                  type="button"
                  onClick={() => window.open(pr.url, "_blank")}
                  className="w-full px-2 py-1.5 text-left hover:bg-muted/50 rounded transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {prInfo.icon}
                    <span>
                      {repoName}#{pr.externalId}
                    </span>
                  </div>
                  <p className="text-xs leading-tight line-clamp-2 mt-0.5">
                    {pr.title || "Pull Request"}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {prInfo.status}
                  </span>
                </button>
              </div>
            );
          })}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return null;
}
