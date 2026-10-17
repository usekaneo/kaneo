import { useTranslation } from "react-i18next";
import type {
  SyncParams,
  SyncPreview,
} from "@/fetchers/integration-sync/types";
import { providerName } from "./provider-name";
import { RuleValue } from "./rule-value";

type SyncRulesSummaryProps = {
  provider: SyncParams["provider"];
  data: SyncPreview;
};

export function SyncRulesSummary({ provider, data }: SyncRulesSummaryProps) {
  const { t } = useTranslation();
  const name = providerName(provider);
  const rows = [
    {
      key: "outgoing",
      label: t("settings:syncRules.kaneoToProvider", { provider: name }),
      rule: data.rules.outgoing,
      outgoing: true,
    },
    {
      key: "incoming",
      label: t("settings:syncRules.providerToKaneo", { provider: name }),
      rule: data.rules.incoming,
      outgoing: false,
    },
  ];

  return (
    <dl className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4"
        >
          <dt className="text-[13px] text-muted-foreground sm:w-40 sm:shrink-0">
            {row.label}
          </dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px]">
            <RuleValue
              rule={row.rule}
              labels={data.labels}
              outgoing={row.outgoing}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}
