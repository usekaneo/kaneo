import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IntegrationPanelRow } from "@/components/project/integrations/panel/integration-panel-row";
import { IntegrationPanelSection } from "@/components/project/integrations/panel/integration-panel-section";
import { Button } from "@/components/ui/button";

type ImportIssuesSectionProps = {
  description: ReactNode;
  actionLabel: string;
  pending: boolean;
  disabled: boolean;
  hint?: string | null;
  onImport: () => void;
};

export function ImportIssuesSection({
  description,
  actionLabel,
  pending,
  disabled,
  hint,
  onImport,
}: ImportIssuesSectionProps) {
  const { t } = useTranslation();

  return (
    <IntegrationPanelSection label={t("settings:codeHosting.issuesSection")}>
      <IntegrationPanelRow
        title={t("settings:codeHosting.importTitle")}
        description={description}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onImport}
          disabled={pending || disabled}
        >
          {pending ? t("settings:codeHosting.importing") : actionLabel}
        </Button>
      </IntegrationPanelRow>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </IntegrationPanelSection>
  );
}
