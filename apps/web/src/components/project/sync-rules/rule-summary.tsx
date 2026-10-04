import { useTranslation } from "react-i18next";
import type { LabelRule, SyncPreview } from "@/fetchers/integration-sync/types";

export function RuleSummary({
  rule,
  labels,
  outgoing,
}: {
  rule: LabelRule;
  labels: SyncPreview["labels"];
  outgoing: boolean;
}) {
  const { t } = useTranslation();
  if (rule.mode === "all") return <>{t("settings:syncRules.all")}</>;
  const names = rule.labels.map((id) =>
    outgoing
      ? (labels.find((label) => label.id === id)?.name ??
        t("settings:syncRules.unavailableLabel"))
      : id,
  );
  return (
    <>
      {rule.match === "all"
        ? t("settings:syncRules.allSummary", { labels: names.join(", ") })
        : t("settings:syncRules.anySummary", { labels: names.join(", ") })}
    </>
  );
}
