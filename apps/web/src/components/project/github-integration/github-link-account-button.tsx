import { useTranslation } from "react-i18next";
import { GithubIcon } from "@/components/icons/github-icon";
import { useLinkGithubAccount } from "@/components/project/github-integration/use-link-github-account";
import { Button } from "@/components/ui/button";

export function GithubLinkAccountButton() {
  const { t } = useTranslation();
  const { link, linking } = useLinkGithubAccount();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={linking}
      onClick={link}
    >
      <GithubIcon aria-hidden="true" />
      {t("settings:githubIntegration.linkGithub")}
    </Button>
  );
}
