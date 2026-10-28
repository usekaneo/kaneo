import { ArrowUpRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CheckingLine } from "@/components/project/code-hosting/checking-line";
import {
  describeGithubVerification,
  githubVerificationTone,
} from "@/components/project/github-integration/describe-github-verification";
import { githubVerificationMessage } from "@/components/project/github-integration/github-verification-message";
import { IntegrationCheckLine } from "@/components/project/integrations/panel/integration-check-line";
import { Button } from "@/components/ui/button";
import type { VerifyGithubInstallationResponse } from "@/fetchers/github-integration/verify-github-installation";
import { openExternalWebUrl } from "@/lib/external-url";

type GithubVerificationLineProps = {
  checking: boolean;
  result: VerifyGithubInstallationResponse | undefined;
  error: unknown;
};

export function GithubVerificationLine({
  checking,
  result,
  error,
}: GithubVerificationLineProps) {
  const { t } = useTranslation();

  if (checking) return <CheckingLine />;
  if (error) {
    return (
      <IntegrationCheckLine tone="destructive">
        {error instanceof Error && error.message
          ? error.message
          : t("settings:githubIntegration.toast.verifyError")}
      </IntegrationCheckLine>
    );
  }
  if (!result) return null;

  const outcome = describeGithubVerification(result);
  const link = (url: string | undefined, label: string) =>
    url ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => openExternalWebUrl(url)}
      >
        {label}
        <ArrowUpRightIcon aria-hidden="true" />
      </Button>
    ) : undefined;

  return (
    <IntegrationCheckLine
      tone={githubVerificationTone(outcome)}
      action={
        outcome.kind === "missingPermissions"
          ? link(
              outcome.settingsUrl,
              t("settings:githubIntegration.updatePermissions"),
            )
          : outcome.kind === "notInstalled"
            ? link(
                outcome.installationUrl,
                t("settings:githubIntegration.installGithubApp"),
              )
            : undefined
      }
    >
      {githubVerificationMessage(outcome, result.message, t)}
    </IntegrationCheckLine>
  );
}
