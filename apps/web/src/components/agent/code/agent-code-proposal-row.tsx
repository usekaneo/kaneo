import { Check, GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GithubIcon } from "@/components/icons/github-icon";
import { Checkbox } from "@/components/ui/checkbox";
import type { AgentCodeProposal } from "@/types/agent";
import { AgentProposalComment } from "../agent-proposal-comment";

type AgentCodeProposalRowProps = {
  proposal: AgentCodeProposal;
  taskKey?: string;
  // Unknown to viewers who can't list coding repositories.
  repositoryName?: string;
  selected: boolean;
  disabled: boolean;
  // Omitted for read-only viewers of a shared conversation.
  onSelectedChange?: (selected: boolean) => void;
};

export function AgentCodeProposalRow({
  proposal,
  taskKey,
  repositoryName,
  selected,
  disabled,
  onSelectedChange,
}: AgentCodeProposalRowProps) {
  const { t } = useTranslation();
  const isPending = proposal.status === "pending";
  const headingId = `agent-proposal-${proposal.id}`;
  const { baseRef, instructions } = proposal.action;

  return (
    <li className="flex gap-2.5 border-border/60 border-b p-3 last:border-b-0">
      <div className="flex size-4 shrink-0 items-center justify-center pt-0.5">
        {isPending && onSelectedChange ? (
          <Checkbox
            checked={selected}
            disabled={disabled}
            onCheckedChange={(checked) => onSelectedChange(checked === true)}
            aria-labelledby={headingId}
          />
        ) : proposal.status === "applied" ? (
          <Check aria-hidden="true" className="size-3.5 text-success" />
        ) : null}
      </div>
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <div id={headingId} className="flex min-w-0 items-baseline gap-1.5">
          {taskKey && (
            <span className="shrink-0 font-medium text-[11px] text-muted-foreground">
              {taskKey}
            </span>
          )}
          <span className="shrink-0 font-medium text-[13px] text-foreground">
            {t("agent:proposal.action.code")}
          </span>
          {!taskKey && proposal.before && (
            <span className="truncate text-[13px] text-muted-foreground">
              {proposal.before.title}
            </span>
          )}
        </div>
        {(repositoryName || baseRef) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
            {repositoryName && (
              <span className="flex min-w-0 items-center gap-1.5">
                <GithubIcon className="size-3 shrink-0" />
                <span className="truncate">{repositoryName}</span>
              </span>
            )}
            {baseRef && (
              <span className="flex min-w-0 items-center gap-1.5">
                <GitBranch aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate font-mono text-[11px]">
                  {baseRef}
                </span>
              </span>
            )}
          </div>
        )}
        <AgentProposalComment body={instructions} />
        <p className="text-muted-foreground text-xs">{proposal.reason}</p>
        {!isPending && (
          <p className="text-muted-foreground text-xs">
            {t(`agent:proposal.status.${proposal.status}`)}
          </p>
        )}
      </div>
    </li>
  );
}
