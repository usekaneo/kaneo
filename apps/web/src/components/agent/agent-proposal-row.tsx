import { Check, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { AgentProposal } from "@/types/agent";
import { AgentProposalChange } from "./agent-proposal-change";
import { AgentProposalComment } from "./agent-proposal-comment";
import { describeAgentProposal } from "./describe-agent-proposal";
import { getProposalActionKey } from "./get-proposal-action-key";

type AgentProposalRowProps = {
  proposal: AgentProposal;
  taskKey?: string;
  selected: boolean;
  disabled: boolean;
  // Omitted for read-only viewers of a shared conversation.
  onSelectedChange?: (selected: boolean) => void;
  onUndo?: () => void;
};

export function AgentProposalRow({
  proposal,
  taskKey,
  selected,
  disabled,
  onSelectedChange,
  onUndo,
}: AgentProposalRowProps) {
  const { t } = useTranslation();
  const summary = describeAgentProposal(proposal);
  const isPending = proposal.status === "pending";
  const canUndo =
    Boolean(onUndo) &&
    proposal.status === "applied" &&
    proposal.action.type !== "task.create";
  const headingId = `agent-proposal-${proposal.id}`;

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
            {t(`agent:proposal.action.${getProposalActionKey(summary)}`)}
          </span>
          {(!taskKey || summary.kind === "create") && (
            <span className="truncate text-[13px] text-muted-foreground">
              {summary.taskTitle}
            </span>
          )}
        </div>
        {summary.kind === "comment" && (
          <AgentProposalComment body={summary.body} />
        )}
        {summary.kind === "create"
          ? summary.changes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {summary.changes.map((change) => (
                  <AgentProposalChange
                    key={change.field}
                    change={change}
                    showPrevious={false}
                  />
                ))}
              </div>
            )
          : summary.changes.map((change) => (
              <AgentProposalChange
                key={change.field}
                change={change}
                showPrevious
              />
            ))}
        <p className="text-muted-foreground text-xs">{proposal.reason}</p>
        {!isPending && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span>{t(`agent:proposal.status.${proposal.status}`)}</span>
            {canUndo && (
              <Button
                variant="ghost"
                size="xs"
                className="h-6 gap-1 px-1.5 text-xs"
                disabled={disabled}
                onClick={onUndo}
              >
                <Undo2 aria-hidden="true" className="size-3" />
                {t("agent:proposal.undo")}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
