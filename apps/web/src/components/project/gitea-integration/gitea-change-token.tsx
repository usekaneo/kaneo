import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isAccessVerified } from "@/components/project/code-hosting/access-verification-tone";
import { ChangeTokenForm } from "@/components/project/code-hosting/change-token-form";
import { useGiteaVerification } from "@/components/project/gitea-integration/use-gitea-verification";
import { useSaveGiteaIntegration } from "@/components/project/gitea-integration/use-save-gitea-integration";
import type { GiteaIntegration } from "@/fetchers/gitea-integration/get-gitea-integration";

type GiteaChangeTokenProps = {
  projectId: string;
  integration: GiteaIntegration;
  onDone: () => void;
};

export function GiteaChangeToken({
  projectId,
  integration,
  onDone,
}: GiteaChangeTokenProps) {
  const { t } = useTranslation();
  const [token, setToken] = useState("");
  const trimmed = token.trim();
  const access = trimmed
    ? {
        baseUrl: integration.baseUrl,
        accessToken: trimmed,
        repositoryOwner: integration.repositoryOwner,
        repositoryName: integration.repositoryName,
      }
    : null;
  const verification = useGiteaVerification(projectId, access);
  const verified = isAccessVerified(verification.result);
  const { save, saving } = useSaveGiteaIntegration(projectId);

  return (
    <ChangeTokenForm
      token={token}
      tokenLabel={t("settings:giteaIntegration.tokenLabel")}
      placeholder={t("settings:giteaIntegration.tokenPlaceholderUpdate")}
      fallbackError={t("settings:giteaIntegration.toast.verifyError")}
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
