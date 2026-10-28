import { useTranslation } from "react-i18next";
import { IntegrationPanelRow } from "@/components/project/integrations/panel/integration-panel-row";
import { Button } from "@/components/ui/button";

type StoredTokenRowProps = {
  maskedToken: string | null | undefined;
  editing: boolean;
  onEdit: () => void;
};

export function StoredTokenRow({
  maskedToken,
  editing,
  onEdit,
}: StoredTokenRowProps) {
  const { t } = useTranslation();

  return (
    <IntegrationPanelRow
      title={t("settings:codeHosting.tokenTitle")}
      description={
        maskedToken ? (
          <span>
            {t("settings:codeHosting.tokenStored")}{" "}
            <span className="font-mono">{maskedToken}</span>
          </span>
        ) : null
      }
    >
      {editing ? null : (
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          {t("settings:codeHosting.changeToken")}
        </Button>
      )}
    </IntegrationPanelRow>
  );
}
