import { useTranslation } from "react-i18next";
import {
  getPullRequestRepoName,
  getPullRequestStatus,
  type PullRequest,
} from "@/lib/pull-request";
import { PullRequestStatusIcon } from "./pull-request-status-icon";

type PullRequestRowProps = {
  pullRequest: PullRequest;
};

export function PullRequestRow({ pullRequest }: PullRequestRowProps) {
  const { t } = useTranslation();
  const status = getPullRequestStatus(pullRequest);
  const repoName = getPullRequestRepoName(pullRequest.url);
  const statusLabel = {
    merged: t("tasks:pr.merged"),
    draft: t("tasks:pr.draft"),
    open: t("tasks:pr.open"),
  }[status];

  return (
    <a
      href={pullRequest.href}
      target="_blank"
      rel="noopener noreferrer"
      title={repoName ? `${repoName}#${pullRequest.externalId}` : undefined}
      className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
    >
      <PullRequestStatusIcon status={status} className="size-3.5" />
      <span className="sr-only">{statusLabel}</span>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {pullRequest.title || t("tasks:pr.label")}
      </span>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        #{pullRequest.externalId}
      </span>
    </a>
  );
}
