import { CircleAlert, CircleCheck, CircleMinus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { AgentRunStatus } from "@/types/agent";

export function AgentRunStatusIcon({ status }: { status: AgentRunStatus }) {
  if (status === "queued" || status === "running")
    return <Spinner className="size-3.5 text-foreground" />;
  if (status === "awaiting_review")
    return <span aria-hidden="true" className="size-2 rounded-full bg-info" />;
  if (status === "failed")
    return (
      <CircleAlert
        aria-hidden="true"
        className="size-3.5 text-destructive-foreground"
      />
    );
  if (status === "cancelled")
    return (
      <CircleMinus
        aria-hidden="true"
        className="size-3.5 text-muted-foreground"
      />
    );
  return (
    <CircleCheck
      aria-hidden="true"
      className="size-3.5 text-muted-foreground"
    />
  );
}
