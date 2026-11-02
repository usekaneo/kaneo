import { useTranslation } from "react-i18next";
import useAgentRun from "@/hooks/queries/agent/use-agent-run";
import { formatDateTime } from "@/lib/format";
import type { AutomationRun } from "@/types/agent-automation";
import { AgentRunOutput } from "../agent-run-output";
import { AutomationRunTrigger } from "./automation-run-trigger";
import { formatCost, formatRunDuration, formatTokens } from "./format-run-meta";

type AutomationRunPanelProps = {
  workspaceId: string;
  runId: string;
  automationId: string;
  conversationId: string | null;
  summary: AutomationRun | undefined;
  readOnly: boolean;
};

export function AutomationRunPanel({
  workspaceId,
  runId,
  automationId,
  conversationId,
  summary,
  readOnly,
}: AutomationRunPanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const { data: run, isError } = useAgentRun(workspaceId, runId, readOnly);
  const source = run ?? summary;
  if (!source)
    return (
      <p
        role={isError ? "alert" : "status"}
        className="text-muted-foreground text-sm"
      >
        {t(isError ? "agent:run.loadError" : "common:empty.loading")}
      </p>
    );
  if (
    source.trigger?.automationId !== automationId ||
    source.conversationId !== conversationId
  )
    return (
      <p role="alert" className="text-destructive-foreground text-sm">
        {t("agent:run.loadError")}
      </p>
    );
  const meta = [
    source.inputTokens + source.outputTokens > 0
      ? t("agent:automations.runs.tokens", {
          value: formatTokens(source.inputTokens + source.outputTokens, locale),
        })
      : null,
    formatCost(source.costUsd, locale),
    formatRunDuration(source.createdAt, source.finishedAt, locale),
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="automation-run-title"
      className="flex min-w-0 flex-col gap-5"
    >
      <div className="flex items-baseline justify-between gap-3 border-border/80 border-b pb-2">
        <h2
          id="automation-run-title"
          className="font-semibold text-[15px] text-foreground"
        >
          {formatDateTime(source.createdAt)}
        </h2>
        {meta.length > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {meta.join(" · ")}
          </span>
        )}
      </div>
      <AutomationRunTrigger
        workspaceId={workspaceId}
        trigger={source.trigger}
      />
      <AgentRunOutput
        workspaceId={workspaceId}
        run={run}
        status={source.status}
        response={run?.response ?? ""}
        error={source.error}
        loadFailed={isError}
        readOnly={readOnly}
      />
    </section>
  );
}
