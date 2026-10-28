import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

type GithubWorkflowHintProps = {
  projectId: string;
};

export function GithubWorkflowHint({ projectId }: GithubWorkflowHintProps) {
  const { t } = useTranslation();

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      {t("settings:githubIntegration.workflowHint")}
      <Link
        to="/dashboard/settings/projects/$projectId/workflow"
        params={{ projectId }}
        className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
      >
        {t("settings:githubIntegration.workflowLink")}
        <ArrowRightIcon aria-hidden="true" className="size-3" />
      </Link>
    </p>
  );
}
