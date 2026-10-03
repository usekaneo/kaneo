import { ArrowRight } from "lucide-react";
import { AgentValueChip } from "./agent-value-chip";
import type { AgentProposalChange as Change } from "./describe-agent-proposal";

type AgentProposalChangeProps = {
  change: Change;
  showPrevious: boolean;
};

export function AgentProposalChange({
  change,
  showPrevious,
}: AgentProposalChangeProps) {
  if (change.field === "title") {
    return (
      <p className="text-foreground/80 text-xs">
        {showPrevious && change.from && (
          <span className="text-muted-foreground line-through">
            {change.from}{" "}
          </span>
        )}
        <span className="font-medium">{change.to}</span>
      </p>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {showPrevious && (
        <>
          <AgentValueChip field={change.field} value={change.from} previous />
          <ArrowRight
            aria-hidden="true"
            className="size-3 shrink-0 text-muted-foreground"
          />
        </>
      )}
      <AgentValueChip field={change.field} value={change.to} />
    </div>
  );
}
