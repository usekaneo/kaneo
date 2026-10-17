import { useTranslation } from "react-i18next";
import { RepositoryPickerMessage } from "@/components/project/code-hosting/picker/repository-picker-message";
import { RepositoryPickerRow } from "@/components/project/code-hosting/picker/repository-picker-row";
import { RepositoryPickerSkeleton } from "@/components/project/code-hosting/picker/repository-picker-skeleton";
import { Button } from "@/components/ui/button";
import type { ListGiteaRepositoriesResponse } from "@/fetchers/gitea-integration/list-gitea-repositories";

type GiteaRepository = ListGiteaRepositoriesResponse["repositories"][number];

type GiteaRepositoryResultsProps = {
  canFetch: boolean;
  isLoading: boolean;
  error: unknown;
  loaded: boolean;
  repositories: GiteaRepository[];
  searching: boolean;
  selected: string | null;
  onSelect: (repository: GiteaRepository) => void;
  onConfirm: (repository: GiteaRepository) => void;
  onRetry: () => void;
};

export function GiteaRepositoryResults({
  canFetch,
  isLoading,
  error,
  loaded,
  repositories,
  searching,
  selected,
  onSelect,
  onConfirm,
  onRetry,
}: GiteaRepositoryResultsProps) {
  const { t } = useTranslation();

  if (!canFetch) {
    return (
      <RepositoryPickerMessage
        title={t("settings:giteaIntegration.browseNeedsCredentials")}
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
            : t("settings:repositoryBrowser.loadError")
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
  if (repositories.length === 0) {
    return (
      <RepositoryPickerMessage
        title={
          searching
            ? t("settings:repositoryBrowser.noSearchMatchTitle")
            : t("settings:giteaIntegration.browseEmpty")
        }
        description={
          searching ? t("settings:repositoryBrowser.noSearchMatchHint") : null
        }
      />
    );
  }

  return (
    <ul className="space-y-0.5">
      {repositories.map((repository) => (
        <RepositoryPickerRow
          key={repository.id}
          name={repository.full_name}
          isPrivate={repository.private}
          selected={selected === repository.full_name}
          onSelect={() => onSelect(repository)}
          onConfirm={() => onConfirm(repository)}
        />
      ))}
    </ul>
  );
}
