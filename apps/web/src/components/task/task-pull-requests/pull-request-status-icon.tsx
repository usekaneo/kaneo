import { GitMerge, GitPullRequest, GitPullRequestClosed } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PullRequestStatus } from "@/lib/pull-request";

const statusClassName: Record<PullRequestStatus, string> = {
  merged: "text-violet-600 dark:text-violet-400",
  draft: "text-muted-foreground",
  open: "text-success-foreground",
  closed: "text-destructive-foreground",
};

type PullRequestStatusIconProps = {
  status: PullRequestStatus;
  className?: string;
};

export function PullRequestStatusIcon({
  status,
  className,
}: PullRequestStatusIconProps) {
  const Icon =
    status === "merged"
      ? GitMerge
      : status === "closed"
        ? GitPullRequestClosed
        : GitPullRequest;
  return (
    <Icon
      aria-hidden
      className={cn("size-3 shrink-0", statusClassName[status], className)}
    />
  );
}
