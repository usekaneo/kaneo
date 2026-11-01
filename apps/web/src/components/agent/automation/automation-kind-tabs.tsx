import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import type { AutomationList } from "@/types/agent-automation";

export type AutomationKind = "all" | "agent" | "rules";
const KINDS: AutomationKind[] = ["all", "agent", "rules"];

type AutomationKindTabsProps = {
  value: AutomationKind;
  onValueChange: (kind: AutomationKind) => void;
  counts: AutomationList["counts"] | undefined;
};

export function AutomationKindTabs({
  value,
  onValueChange,
  counts,
}: AutomationKindTabsProps) {
  const { t } = useTranslation();
  return (
    <Tabs
      value={value}
      onValueChange={(next: AutomationKind) => onValueChange(next)}
    >
      <TabsList aria-label={t("agent:automations.kinds.label")}>
        {KINDS.map((kind) => (
          <TabsTab key={kind} value={kind} className="px-2.5 sm:h-7">
            {t(`agent:automations.kinds.${kind}`)}
            {counts && (
              <span className="font-normal text-muted-foreground tabular-nums">
                {counts[kind]}
              </span>
            )}
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  );
}
