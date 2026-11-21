import { useTranslation } from "react-i18next";
import { useTangledOutcome } from "@/hooks/queries/tangled-integration/use-tangled-outcome";

const descriptions = {
  branch_linked: "settings:tangledIntegration.outcomes.branchLinked",
  branch_unchanged: "settings:tangledIntegration.outcomes.branchUnchanged",
  branch_missing: "settings:tangledIntegration.outcomes.branchMissing",
  branch_unmatched: "settings:tangledIntegration.outcomes.branchUnmatched",
  branch_conflict: "settings:tangledIntegration.outcomes.branchConflict",
  task_not_found: "settings:tangledIntegration.outcomes.taskNotFound",
  tag_ignored: "settings:tangledIntegration.outcomes.tagIgnored",
  pull_request_unsupported:
    "settings:tangledIntegration.outcomes.prUnsupported",
  upstream_failed: "settings:tangledIntegration.outcomes.upstreamFailed",
  repository_changed: "settings:tangledIntegration.outcomes.repositoryChanged",
} as const;

export function TangledOutcome({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const query = useTangledOutcome(projectId, true);
  if (query.isLoading)
    return (
      <p role="status">{t("settings:tangledIntegration.outcomeLoading")}</p>
    );
  if (query.isError)
    return <p role="alert">{t("settings:tangledIntegration.outcomeError")}</p>;
  if (!query.data)
    return <p>{t("settings:tangledIntegration.outcomeEmpty")}</p>;
  return (
    <p role="status">
      {t(descriptions[query.data.code])}
      {query.data.ref ? ` (${query.data.ref})` : ""}
    </p>
  );
}
