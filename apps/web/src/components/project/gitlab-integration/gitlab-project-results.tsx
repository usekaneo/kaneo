import { useTranslation } from "react-i18next";
import { RepositoryPickerMessage } from "@/components/project/code-hosting/picker/repository-picker-message";
import { RepositoryPickerRow } from "@/components/project/code-hosting/picker/repository-picker-row";
import { RepositoryPickerSkeleton } from "@/components/project/code-hosting/picker/repository-picker-skeleton";
import { Button } from "@/components/ui/button";
import type { ListGitlabProjectsResponse } from "@/fetchers/gitlab-integration/list-gitlab-projects";

type GitlabProject = ListGitlabProjectsResponse["projects"][number];

type GitlabProjectResultsProps = {
  canFetch: boolean;
  isLoading: boolean;
  error: unknown;
  loaded: boolean;
  projects: GitlabProject[];
  searching: boolean;
  selected: string | null;
  onSelect: (project: GitlabProject) => void;
  onConfirm: (project: GitlabProject) => void;
  onRetry: () => void;
};

export function GitlabProjectResults({
  canFetch,
  isLoading,
  error,
  loaded,
  projects,
  searching,
  selected,
  onSelect,
  onConfirm,
  onRetry,
}: GitlabProjectResultsProps) {
  const { t } = useTranslation();

  if (!canFetch) {
    return (
      <RepositoryPickerMessage
        title={t("settings:gitlabIntegration.browseNeedsCredentials")}
      />
    );
  }
  if (isLoading) return <RepositoryPickerSkeleton />;
  if (error) {
    return (
      <RepositoryPickerMessage
        tone="destructive"
        title={
          error instanceof Error && error.message
            ? error.message
            : t("settings:gitlabIntegration.loadProjectsError")
        }
        action={
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t("settings:codeHosting.retry")}
          </Button>
        }
      />
    );
  }
  if (!loaded) return null;
  if (projects.length === 0) {
    return (
      <RepositoryPickerMessage
        title={
          searching
            ? t("settings:gitlabIntegration.noSearchMatchTitle")
            : t("settings:gitlabIntegration.browseEmpty")
        }
        description={
          searching ? t("settings:repositoryBrowser.noSearchMatchHint") : null
        }
      />
    );
  }

  return (
    <ul className="space-y-0.5">
      {projects.map((project) => (
        <RepositoryPickerRow
          key={project.id}
          name={project.path_with_namespace}
          isPrivate={project.visibility !== "public"}
          meta={project.name_with_namespace}
          selected={selected === project.path_with_namespace}
          onSelect={() => onSelect(project)}
          onConfirm={() => onConfirm(project)}
        />
      ))}
    </ul>
  );
}
