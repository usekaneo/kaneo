import { GitPullRequest } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { AgentCodeJob } from "@/types/agent";
import { type CodeJobTone, getCodeJobLabel } from "./get-code-job-label";

const toneClassName: Record<CodeJobTone, string> = {
  active: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success-foreground",
  danger: "bg-destructive/10 text-destructive-foreground",
  neutral: "bg-muted text-muted-foreground",
};

type AgentCodeJobPillProps = {
  job: Pick<AgentCodeJob, "status" | "outcome" | "prNumber" | "prUrl">;
  // Link the pill to its pull request; off inside clickable rows.
  linkPullRequest?: boolean;
};

export function AgentCodeJobPill({
  job,
  linkPullRequest = false,
}: AgentCodeJobPillProps) {
  const { t } = useTranslation();
  const label = getCodeJobLabel(job);
  const isPullRequest = label.tone === "success";
  const className = cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 font-medium text-xs",
    toneClassName[label.tone],
  );
  const content = (
    <>
      {isPullRequest && (
        <GitPullRequest aria-hidden="true" className="size-3 shrink-0" />
      )}
      {t(label.key, label.values)}
    </>
  );

  if (linkPullRequest && isPullRequest && job.prUrl)
    return (
      <a
        href={job.prUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          className,
          "outline-none transition-colors hover:bg-success/15 focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {content}
      </a>
    );

  return <span className={className}>{content}</span>;
}
