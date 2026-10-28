import { CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GithubLinkAccountButton } from "@/components/project/github-integration/github-link-account-button";
import { IntegrationStep } from "@/components/project/integrations/panel/integration-step";
import type { GitHubAppInfo } from "@/fetchers/github-integration/get-app-info";

type GithubAccountStepProps = {
  appInfo: GitHubAppInfo | undefined;
};

export function GithubAccountStep({ appInfo }: GithubAccountStepProps) {
  const { t } = useTranslation();
  const linked = Boolean(appInfo?.accountConnected);
  const canLink = Boolean(
    appInfo && !linked && appInfo.accountLinkingAvailable,
  );

  return (
    <IntegrationStep
      number={1}
      done={linked}
      title={t("settings:githubIntegration.linkAccountTitle")}
      description={t("settings:githubIntegration.linkAccountDescription")}
      aside={
        linked ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckIcon
              aria-hidden="true"
              className="size-3.5 text-success-foreground"
            />
            {t("settings:githubIntegration.linked")}
          </span>
        ) : canLink ? (
          <GithubLinkAccountButton />
        ) : null
      }
    >
      {appInfo && !linked && !appInfo.accountLinkingAvailable ? (
        <p className="text-xs text-muted-foreground">
          {t("settings:githubIntegration.enableGithubSignInHint")}
        </p>
      ) : null}
    </IntegrationStep>
  );
}
