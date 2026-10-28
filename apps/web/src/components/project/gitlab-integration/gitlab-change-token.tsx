import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isAccessVerified } from "@/components/project/code-hosting/access-verification-tone";
import { ChangeTokenForm } from "@/components/project/code-hosting/change-token-form";
import type { GitlabTokenType } from "@/components/project/gitlab-integration/gitlab-access";
import { GitlabTokenTypeSelect } from "@/components/project/gitlab-integration/gitlab-token-type-select";
import { useGitlabVerification } from "@/components/project/gitlab-integration/use-gitlab-verification";
import { useSaveGitlabIntegration } from "@/components/project/gitlab-integration/use-save-gitlab-integration";
import type { GitlabIntegration } from "@/fetchers/gitlab-integration/get-gitlab-integration";

type GitlabChangeTokenProps = {
  projectId: string;
  integration: GitlabIntegration;
  onDone: () => void;
};

export function GitlabChangeToken({
  projectId,
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
  const { save, saving } = useSaveGitlabIntegration(projectId);

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
        if (access && (await save(access, verified))) onDone();
      }}
    />
  );
}
