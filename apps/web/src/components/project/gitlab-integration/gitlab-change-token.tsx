import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isAccessVerified } from "@/components/project/code-hosting/access-verification-tone";
import { ChangeTokenForm } from "@/components/project/code-hosting/change-token-form";
import type { GitlabTokenType } from "@/components/project/gitlab-integration/gitlab-access";
import { GitlabTokenTypeSelect } from "@/components/project/gitlab-integration/gitlab-token-type-select";
import { useGitlabVerification } from "@/components/project/gitlab-integration/use-gitlab-verification";
import type { GitlabIntegration } from "@/fetchers/gitlab-integration/get-gitlab-integrations";
import { useUpdateGitlabIntegration } from "@/hooks/mutations/gitlab-integration/use-update-gitlab-integration";
import { toast } from "@/lib/toast";

type GitlabChangeTokenProps = {
  projectId: string;
  integrationId: string;
  integration: GitlabIntegration;
  onDone: () => void;
};

export function GitlabChangeToken({
  projectId,
  integrationId,
  integration,
  onDone,
}: GitlabChangeTokenProps) {
  const { t } = useTranslation();
  const [token, setToken] = useState("");
  const [tokenType, setTokenType] = useState<GitlabTokenType>(
    integration.tokenType,
  );
  const trimmed = token.trim();
  const access = trimmed
    ? {
        baseUrl: integration.baseUrl,
        accessToken: trimmed,
        tokenType,
        projectPath: integration.projectPath,
      }
    : null;
  const verification = useGitlabVerification(projectId, access);
  const verified = isAccessVerified(verification.result);
  const { mutateAsync: update, isPending: saving } =
    useUpdateGitlabIntegration();

  return (
    <ChangeTokenForm
      token={token}
      tokenLabel={t("settings:gitlabIntegration.tokenLabel")}
      placeholder={t("settings:gitlabIntegration.tokenPlaceholderUpdate")}
      fallbackError={t("settings:gitlabIntegration.toast.verifyError")}
      extra={
        <GitlabTokenTypeSelect
          value={tokenType}
          disabled={saving}
          onChange={setTokenType}
        />
      }
      verification={verification}
      saving={saving}
      canSave={
        access !== null && (verification.result === undefined || verified)
      }
      onTokenChange={setToken}
      onCancel={onDone}
      onSave={async () => {
        if (!access) return;
        try {
          await update({
            projectId,
            integrationId,
            json: {
              accessToken: access.accessToken,
              tokenType: access.tokenType,
            },
          });
          toast.success(t("settings:gitlabIntegration.toast.updated"));
          onDone();
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("settings:gitlabIntegration.toast.updateError"),
          );
        }
      }}
    />
  );
}
