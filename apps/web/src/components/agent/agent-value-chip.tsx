import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/get-initials";
import type { AgentProposalField } from "./describe-agent-proposal";
import { useAgentValueFormatter } from "./use-agent-value-formatter";

type AgentValueChipProps = {
  field: AgentProposalField;
  value: string | null;
  previous?: boolean;
};

export function AgentValueChip({
  field,
  value,
  previous,
}: AgentValueChipProps) {
  const format = useAgentValueFormatter();
  const label = format(field, value);

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs",
        previous
          ? "bg-muted text-muted-foreground"
          : "bg-info/10 font-medium text-info-foreground",
      )}
    >
      {field === "assignee" && value && (
        <span
          aria-hidden="true"
          className="-ml-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-background font-semibold text-[8px]"
        >
          {getInitials(label)}
        </span>
      )}
      <span className={cn("truncate", previous && "line-through")}>
        {label}
      </span>
    </span>
  );
}
