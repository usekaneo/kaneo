import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RepositoryChoiceStep } from "@/components/project/code-hosting/repository-choice-step";
import {
  formatRepositoryPath,
  GITHUB_OWNER_PATTERN,
  parseRepositoryPath,
} from "@/components/project/code-hosting/parse-repository-path";
import { isGithubVerificationReady } from "@/components/project/github-integration/describe-github-verification";
import { GithubAccountStep } from "@/components/project/github-integration/github-account-step";
import { GithubRepositoryPicker } from "@/components/project/github-integration/github-repository-picker";
import { GithubVerificationLine } from "@/components/project/github-integration/github-verification-line";
import { useConnectGithubRepository } from "@/components/project/github-integration/use-connect-github-repository";
import { useGithubVerification } from "@/components/project/github-integration/use-github-verification";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelFooter } from "@/components/project/integrations/panel/integration-panel-footer";
import { IntegrationSteps } from "@/components/project/integrations/panel/integration-steps";
import { Button } from "@/components/ui/button";
import type { GitHubAppInfo } from "@/fetchers/github-integration/get-app-info";

type GithubSetupPanelProps = {
  projectId: string;
  appInfo: GitHubAppInfo | undefined;
};

export function GithubSetupPanel({
  projectId,
  appInfo,
}: GithubSetupPanelProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const linked = Boolean(appInfo?.accountConnected);
  const repository = parseRepositoryPath(value, GITHUB_OWNER_PATTERN);
  const verification = useGithubVerification(
    projectId,
    linked ? repository : null,
  );
  const { connect, connecting } = useConnectGithubRepository(projectId);
  const blocked =
    verification.result !== undefined &&
    !isGithubVerificationReady(verification.result);
  const invalid = touched && value.trim() !== "" && repository === null;

  return (
    <>
      <IntegrationPanel>
        <IntegrationSteps>
          <GithubAccountStep appInfo={appInfo} />
          <RepositoryChoiceStep
            title={t("settings:codeHosting.chooseRepositoryTitle")}
            description={t(
              "settings:githubIntegration.chooseRepositoryDescription",
            )}
            inputLabel={t("settings:codeHosting.repositoryPathLabel")}
            placeholder="owner/repository"
            value={value}
            invalidMessage={
              invalid ? t("settings:codeHosting.repositoryPathInvalid") : null
            }
            disabled={connecting}
            browseDisabled={!linked}
            status={<GithubVerificationLine {...verification} />}
            onChange={(next) => {
              setValue(next);
              if (parseRepositoryPath(next, GITHUB_OWNER_PATTERN))
                setTouched(true);
            }}
            onBlur={() => setTouched(true)}
            onBrowse={() => setBrowsing(true)}
          />
        </IntegrationSteps>
        <IntegrationPanelFooter>
          <Button
            type="button"
            loading={connecting}
            disabled={!linked || !repository || blocked}
            onClick={() => {
              if (repository) void connect(repository);
            }}
          >
            {t("settings:codeHosting.connectRepository")}
          </Button>
        </IntegrationPanelFooter>
      </IntegrationPanel>
      <GithubRepositoryPicker
        projectId={projectId}
        open={browsing}
        onOpenChange={setBrowsing}
        selectedRepository={
          repository
            ? formatRepositoryPath(repository.owner, repository.name)
            : undefined
        }
        onSelectRepository={(selected) => {
          setValue(formatRepositoryPath(selected.owner, selected.name));
          setTouched(true);
        }}
      />
    </>
  );
}
