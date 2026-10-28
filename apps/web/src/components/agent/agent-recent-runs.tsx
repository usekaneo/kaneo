import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useRecentAgentRuns from "@/hooks/queries/agent/use-recent-agent-runs";
import { AgentRecentRunRow } from "./agent-recent-run-row";

type AgentRecentRunsProps = {
  workspaceId: string;
  onOpen: (conversationId: string) => void;
};

export function AgentRecentRuns({ workspaceId, onOpen }: AgentRecentRunsProps) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useRecentAgentRuns(workspaceId);

  return (
    <section className="flex flex-col">
      <div className="border-border/80 border-b pb-2.5">
        <h2 className="font-semibold text-[15px] text-foreground">
          {t("agent:recent.title")}
        </h2>
      </div>
      {isPending ? (
        <p role="status" className="py-4 text-muted-foreground text-sm">
          {t("common:empty.loading")}
        </p>
      ) : isError ? (
        <div className="flex items-center gap-3 py-4">
          <p role="alert" className="text-muted-foreground text-sm">
            {t("agent:recent.loadError")}
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t("common:error.tryAgain")}
          </Button>
        </div>
      ) : data.length === 0 ? (
        <p className="py-4 text-muted-foreground text-sm">
          {t("agent:recent.empty")}
        </p>
      ) : (
        <ul>
          {data.map((run) => (
            <AgentRecentRunRow
              key={run.id}
              run={run}
              onOpen={() => onOpen(run.conversationId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
