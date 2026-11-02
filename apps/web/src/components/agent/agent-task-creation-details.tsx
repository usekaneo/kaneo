import { useTranslation } from "react-i18next";
import { AgentProposalComment } from "./agent-proposal-comment";
import type { AgentCreationDestination } from "./agent-creation-destination";

type AgentTaskCreationDetailsProps = {
  description: string;
  destination: AgentCreationDestination | undefined;
};

export function AgentTaskCreationDetails({
  description,
  destination,
}: AgentTaskCreationDetailsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">
          {t("tasks:properties.project")}
        </dt>
        <dd className="break-words text-foreground">
          {destination?.projectName ??
            (destination?.pending ? t("common:empty.loading") : "—")}
        </dd>
        <dt className="text-muted-foreground">{t("tasks:status.label")}</dt>
        <dd className="break-words text-foreground">
          {destination?.statusName ??
            (destination?.pending ? t("common:empty.loading") : "—")}
        </dd>
      </dl>
      {!destination?.pending && !destination?.ready && (
        <p role="alert" className="text-destructive-foreground text-xs">
          {t("agent:proposal.destinationUnavailable")}
        </p>
      )}
      {description ? (
        <AgentProposalComment body={description} />
      ) : (
        <p className="text-muted-foreground text-xs">
          {t("agent:proposal.noDescription")}
        </p>
      )}
    </div>
  );
}
