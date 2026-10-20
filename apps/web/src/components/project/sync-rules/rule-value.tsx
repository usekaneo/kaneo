import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import type { LabelRule, SyncPreview } from "@/fetchers/integration-sync/types";
import { LabelPill } from "./label-pill";

type RuleValueProps = {
  rule: LabelRule;
  labels: SyncPreview["labels"];
  outgoing: boolean;
};

export function RuleValue({ rule, labels, outgoing }: RuleValueProps) {
  const { t } = useTranslation();

  if (rule.mode === "all") {
    return (
      <span>
        {outgoing
          ? t("settings:syncRules.allTasks")
          : t("settings:syncRules.allIssues")}
      </span>
    );
  }

  const pills = rule.labels.map((id) => {
    if (!outgoing) return { key: id, name: id, color: null };
    const label = labels.find((item) => item.id === id);
    return {
      key: id,
      name: label?.name ?? t("settings:syncRules.unavailableLabel"),
      color: label?.color ?? null,
    };
  });
  const joiner =
    rule.match === "all"
      ? t("settings:syncRules.joinAnd")
      : t("settings:syncRules.joinOr");

  return (
    <>
      <span>
        {outgoing
          ? t("settings:syncRules.tasksLabelled")
          : t("settings:syncRules.issuesLabelled")}
      </span>
      {pills.map((pill, index) => (
        <Fragment key={pill.key}>
          {index > 0 ? (
            <span className="text-muted-foreground">{joiner}</span>
          ) : null}
          <LabelPill name={pill.name} color={pill.color} />
        </Fragment>
      ))}
    </>
  );
}
