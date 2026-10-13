import { GitMerge, GitPullRequest } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PullRequestStatus } from "@/lib/pull-request";

const statusClassName: Record<PullRequestStatus, string> = {
  merged: "text-info-foreground",
  draft: "text-muted-foreground",
  open: "text-success-foreground",
};

type PullRequestStatusIconProps = {
  status: PullRequestStatus;
  className?: string;
};

export function PullRequestStatusIcon({
  status,
  className,
}: PullRequestStatusIconProps) {
  const Icon = status === "merged" ? GitMerge : GitPullRequest;
  return (
    <Icon
      aria-hidden
      className={cn("size-3 shrink-0", statusClassName[status], className)}
    />
  );
}
