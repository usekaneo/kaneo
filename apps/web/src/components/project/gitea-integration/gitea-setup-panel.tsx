import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessVerificationLine } from "@/components/project/code-hosting/access-verification-line";
import { isAccessVerified } from "@/components/project/code-hosting/access-verification-tone";
import { isValidUrl } from "@/components/project/code-hosting/is-valid-url";
import {
  formatRepositoryPath,
  GITEA_OWNER_PATTERN,
  parseRepositoryPath,
} from "@/components/project/code-hosting/parse-repository-path";
import { RepositoryChoiceStep } from "@/components/project/code-hosting/repository-choice-step";
import { GiteaRepositoryPicker } from "@/components/project/gitea-integration/gitea-repository-picker";
import { GiteaSignInStep } from "@/components/project/gitea-integration/gitea-sign-in-step";
import { useGiteaVerification } from "@/components/project/gitea-integration/use-gitea-verification";
import { useSaveGiteaIntegration } from "@/components/project/gitea-integration/use-save-gitea-integration";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelFooter } from "@/components/project/integrations/panel/integration-panel-footer";
import { IntegrationSteps } from "@/components/project/integrations/panel/integration-steps";
import { Button } from "@/components/ui/button";

type GiteaSetupPanelProps = {
  projectId: string;
};

export function GiteaSetupPanel({ projectId }: GiteaSetupPanelProps) {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [path, setPath] = useState("");
  const [touched, setTouched] = useState({ baseUrl: false, path: false });
  const [browsing, setBrowsing] = useState(false);
  const { save, saving } = useSaveGiteaIntegration(projectId);

  const trimmedUrl = baseUrl.trim();
  const trimmedToken = token.trim();
  const urlValid = isValidUrl(trimmedUrl);
  const repository = parseRepositoryPath(path, GITEA_OWNER_PATTERN);
  const access =
    urlValid && repository && trimmedToken
      ? {
          baseUrl: trimmedUrl,
          accessToken: trimmedToken,
          repositoryOwner: repository.owner,
          repositoryName: repository.name,
        }
      : null;
  const verification = useGiteaVerification(projectId, access);
  const verified = isAccessVerified(verification.result);
  const blocked = verification.result !== undefined && !verified;

  const baseUrlError = !touched.baseUrl
    ? null
    : !trimmedUrl
      ? t("settings:giteaIntegration.validation.baseUrlRequired")
      : urlValid
        ? null
        : t("settings:giteaIntegration.validation.baseUrlInvalid");
  const pathInvalid = touched.path && path.trim() !== "" && !repository;

  return (
    <>
      <IntegrationPanel>
        <IntegrationSteps>
          <GiteaSignInStep
            baseUrl={baseUrl}
            token={token}
            baseUrlError={baseUrlError}
            disabled={saving}
            onBaseUrlChange={setBaseUrl}
            onBaseUrlBlur={() =>
              setTouched((current) => ({ ...current, baseUrl: true }))
            }
            onTokenChange={setToken}
          />
          <RepositoryChoiceStep
            title={t("settings:codeHosting.chooseRepositoryTitle")}
            description={t(
              "settings:giteaIntegration.chooseRepositoryDescription",
            )}
            inputLabel={t("settings:codeHosting.repositoryPathLabel")}
            placeholder="owner/repository"
            value={path}
            invalidMessage={
              pathInvalid
                ? t("settings:codeHosting.repositoryPathInvalid")
                : null
            }
            disabled={saving}
            browseDisabled={!trimmedUrl || !trimmedToken}
            status={
              <AccessVerificationLine
                {...verification}
                fallbackError={t("settings:giteaIntegration.toast.verifyError")}
              />
            }
            onChange={setPath}
            onBlur={() => setTouched((current) => ({ ...current, path: true }))}
            onBrowse={() => setBrowsing(true)}
          />
        </IntegrationSteps>
        <IntegrationPanelFooter>
          <Button
            type="button"
            loading={saving}
            disabled={!access || blocked}
            onClick={() => {
              if (access) void save(access, verified);
            }}
          >
            {t("settings:codeHosting.connectRepository")}
          </Button>
        </IntegrationPanelFooter>
      </IntegrationPanel>
      <GiteaRepositoryPicker
        open={browsing}
        projectId={projectId}
        onOpenChange={setBrowsing}
        onSelectRepository={(selected) => {
          setPath(formatRepositoryPath(selected.owner, selected.name));
          setTouched((current) => ({ ...current, path: true }));
        }}
        selectedRepository={
          repository
            ? formatRepositoryPath(repository.owner, repository.name)
            : undefined
        }
        baseUrl={trimmedUrl}
        accessToken={trimmedToken}
      />
    </>
  );
}
