import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SetupField } from "@/components/project/code-hosting/setup-field";
import {
  GITLAB_CLOUD_URL,
  type GitlabTokenType,
} from "@/components/project/gitlab-integration/gitlab-access";
import { GitlabTokenTypeSelect } from "@/components/project/gitlab-integration/gitlab-token-type-select";
import { IntegrationStep } from "@/components/project/integrations/panel/integration-step";
import { Input } from "@/components/ui/input";

type GitlabSignInStepProps = {
  baseUrl: string;
  token: string;
  tokenType: GitlabTokenType;
  baseUrlError: string | null;
  disabled: boolean;
  onBaseUrlChange: (value: string) => void;
  onBaseUrlBlur: () => void;
  onTokenChange: (value: string) => void;
  onTokenTypeChange: (value: GitlabTokenType) => void;
};

export function GitlabSignInStep({
  baseUrl,
  token,
  tokenType,
  baseUrlError,
  disabled,
  onBaseUrlChange,
  onBaseUrlBlur,
  onTokenChange,
  onTokenTypeChange,
}: GitlabSignInStepProps) {
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
          label={t("settings:gitlabIntegration.baseUrlLabel")}
          htmlFor={`${id}-url`}
          error={baseUrlError}
        >
          <Input
            id={`${id}-url`}
            type="url"
            placeholder={GITLAB_CLOUD_URL}
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
          label={t("settings:gitlabIntegration.tokenTypeLabel")}
          htmlFor={`${id}-type`}
        >
          <GitlabTokenTypeSelect
            id={`${id}-type`}
            value={tokenType}
            disabled={disabled}
            onChange={onTokenTypeChange}
          />
        </SetupField>
      </div>
      <SetupField
        label={t("settings:gitlabIntegration.tokenLabel")}
        htmlFor={`${id}-token`}
      >
        <Input
          id={`${id}-token`}
          type="password"
          autoComplete="off"
          placeholder={t("settings:gitlabIntegration.tokenPlaceholder")}
          value={token}
          disabled={disabled}
          onChange={(event) => onTokenChange(event.target.value)}
        />
      </SetupField>
    </IntegrationStep>
  );
}
