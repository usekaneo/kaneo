import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SetupField } from "@/components/project/code-hosting/setup-field";
import { IntegrationStep } from "@/components/project/integrations/panel/integration-step";
import { Input } from "@/components/ui/input";

type GiteaSignInStepProps = {
  baseUrl: string;
  token: string;
  baseUrlError: string | null;
  disabled: boolean;
  onBaseUrlChange: (value: string) => void;
  onBaseUrlBlur: () => void;
  onTokenChange: (value: string) => void;
};

export function GiteaSignInStep({
  baseUrl,
  token,
  baseUrlError,
  disabled,
  onBaseUrlChange,
  onBaseUrlBlur,
  onTokenChange,
}: GiteaSignInStepProps) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <IntegrationStep
      number={1}
      title={t("settings:codeHosting.signInTitle")}
      description={t("settings:codeHosting.signInDescription")}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SetupField
          label={t("settings:giteaIntegration.baseUrlLabel")}
          htmlFor={`${id}-url`}
          error={baseUrlError}
        >
          <Input
            id={`${id}-url`}
            type="url"
            placeholder="https://gitea.example.com"
            autoComplete="off"
            value={baseUrl}
            disabled={disabled}
            aria-invalid={baseUrlError ? true : undefined}
            aria-describedby={baseUrlError ? `${id}-url-error` : undefined}
            onChange={(event) => onBaseUrlChange(event.target.value)}
            onBlur={onBaseUrlBlur}
          />
        </SetupField>
        <SetupField
          label={t("settings:giteaIntegration.tokenLabel")}
          htmlFor={`${id}-token`}
        >
          <Input
            id={`${id}-token`}
            type="password"
            autoComplete="off"
            placeholder={t("settings:giteaIntegration.tokenPlaceholder")}
            value={token}
            disabled={disabled}
            onChange={(event) => onTokenChange(event.target.value)}
          />
        </SetupField>
      </div>
    </IntegrationStep>
  );
}
