import { useId } from "react";
import { useTranslation } from "react-i18next";
import { CopyValueButton } from "@/components/project/code-hosting/copy-value-button";
import { WebhookFieldRow } from "@/components/project/code-hosting/webhook-field-row";
import { WebhookSecretField } from "@/components/project/code-hosting/webhook-secret-field";
import { IntegrationPanelSection } from "@/components/project/integrations/panel/integration-panel-section";
import { Input } from "@/components/ui/input";

type WebhookSectionProps = {
  url: string;
  secret: string | null | undefined;
  description: string;
  events: string;
};

export function WebhookSection({
  url,
  secret,
  description,
  events,
}: WebhookSectionProps) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <IntegrationPanelSection
      label={t("settings:codeHosting.webhookSection")}
      description={description}
    >
      <div className="space-y-2">
        <WebhookFieldRow
          label={t("settings:codeHosting.webhookUrl")}
          labelId={`${id}-url`}
        >
          <Input
            readOnly
            value={url}
            aria-labelledby={`${id}-url`}
            className="min-w-0 flex-1 font-mono text-xs sm:text-xs"
          />
          <CopyValueButton
            value={url}
            label={t("settings:codeHosting.copyUrl")}
          />
        </WebhookFieldRow>
        {secret ? (
          <WebhookFieldRow
            label={t("settings:codeHosting.webhookSecret")}
            labelId={`${id}-secret`}
          >
            <WebhookSecretField secret={secret} labelledBy={`${id}-secret`} />
            <CopyValueButton
              value={secret}
              label={t("settings:codeHosting.copySecret")}
            />
          </WebhookFieldRow>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{events}</p>
    </IntegrationPanelSection>
  );
}
