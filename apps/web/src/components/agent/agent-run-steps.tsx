import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import type { AgentStep } from "@/types/agent";

type AgentRunStepsProps = {
  steps: AgentStep[];
  active: boolean;
};

export function AgentRunSteps({ steps, active }: AgentRunStepsProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const open = active || expanded;

  if (steps.length === 0 && !active) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="flex w-fit items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground"
        aria-expanded={open}
        disabled={active}
        onClick={() => setExpanded((value) => !value)}
      >
        {active ? (
          <Spinner className="size-3.5" />
        ) : (
          <Check aria-hidden="true" className="size-3.5" />
        )}
        {active
          ? t("agent:run.working")
          : t("agent:run.steps", { count: steps.length })}
        {!active && (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3 transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        )}
      </button>
      {open && steps.length > 0 && (
        <ol className="ml-1.5 flex flex-col gap-1.5 border-border border-l pl-1.5">
          {steps.map((step) => (
            <li key={step.id} className="flex gap-2 pl-2">
              <span className="w-24 shrink-0 truncate font-mono text-[11px] text-muted-foreground/80 leading-4">
                {step.toolName}
              </span>
              <span
                className={cn(
                  "min-w-0 text-xs leading-4",
                  step.status === "failed"
                    ? "text-destructive-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.summary ??
                  (step.status === "running"
                    ? t("agent:run.stepRunning")
                    : t("agent:run.stepDone"))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
