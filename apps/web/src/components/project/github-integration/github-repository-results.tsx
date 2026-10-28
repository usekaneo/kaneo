import { ArrowUpRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RepositoryPickerMessage } from "@/components/project/code-hosting/picker/repository-picker-message";
import { RepositoryPickerRow } from "@/components/project/code-hosting/picker/repository-picker-row";
import { RepositoryPickerSkeleton } from "@/components/project/code-hosting/picker/repository-picker-skeleton";
import { GithubRepositoryMeta } from "@/components/project/github-integration/github-repository-meta";
import { Button } from "@/components/ui/button";
import type { GithubRepository } from "@/fetchers/github-integration/list-repositories";
import { openExternalWebUrl } from "@/lib/external-url";

type GithubRepositoryResultsProps = {
  repositories: GithubRepository[];
  searching: boolean;
  isPending: boolean;
  isError: boolean;
  isFetchNextPageError: boolean;
  hasNextPage: boolean;
  fetchingMore: boolean;
  appName: string | null | undefined;
  selected: string | null;
  onSelect: (repository: GithubRepository) => void;
  onConfirm: (repository: GithubRepository) => void;
  onRetry: () => void;
  onLoadMore: () => void;
};

export function GithubRepositoryResults({
  repositories,
  searching,
  isPending,
  isError,
  isFetchNextPageError,
  hasNextPage,
  fetchingMore,
  appName,
  selected,
  onSelect,
  onConfirm,
  onRetry,
  onLoadMore,
}: GithubRepositoryResultsProps) {
  const { t } = useTranslation();

  if (isPending) {
    return (
      <>
        <RepositoryPickerSkeleton />
        {searching ? (
          <p className="px-3 py-2 text-center text-xs text-muted-foreground">
            {t("settings:repositoryBrowser.searching")}
          </p>
        ) : null}
      </>
    );
  }
  if (isError && !isFetchNextPageError) {
    return (
      <RepositoryPickerMessage
        tone="destructive"
        title={t("settings:repositoryBrowser.loadError")}
        action={
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t("settings:repositoryBrowser.tryAgain")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {repositories.length > 0 ? (
        <ul className="space-y-0.5">
          {repositories.map((repository) => (
            <RepositoryPickerRow
              key={repository.id}
              name={repository.full_name}
              isPrivate={repository.private}
              meta={<GithubRepositoryMeta repository={repository} />}
              selected={selected === repository.full_name}
              onSelect={() => onSelect(repository)}
              onConfirm={() => onConfirm(repository)}
            />
          ))}
        </ul>
      ) : fetchingMore ? null : searching ? (
        <RepositoryPickerMessage
          title={t("settings:repositoryBrowser.noSearchMatchTitle")}
          description={t("settings:repositoryBrowser.noSearchMatchHint")}
        />
      ) : (
        <RepositoryPickerMessage
          title={t("settings:repositoryBrowser.emptyTitle")}
          description={
            hasNextPage
              ? t("settings:repositoryBrowser.emptyPageHint")
              : t("settings:repositoryBrowser.emptyHint")
          }
          action={
            !hasNextPage && appName ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  openExternalWebUrl(`https://github.com/apps/${appName}`)
                }
              >
                {t("settings:repositoryBrowser.installGithubApp")}
                <ArrowUpRightIcon aria-hidden="true" />
              </Button>
            ) : undefined
          }
        />
      )}
      {isFetchNextPageError ? (
        <div
          role="alert"
          className="flex items-center justify-center gap-3 px-3 py-2"
        >
          <p className="text-xs text-destructive-foreground">
            {t("settings:repositoryBrowser.loadError")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
          >
            {t("settings:repositoryBrowser.tryAgain")}
          </Button>
        </div>
      ) : fetchingMore ? (
        <p
          role="status"
          className="px-3 py-2 text-center text-xs text-muted-foreground"
        >
          {searching
            ? t("settings:repositoryBrowser.searching")
            : t("common:empty.loading")}
        </p>
      ) : hasNextPage ? (
        <div className="flex justify-center py-1">
          <Button type="button" variant="ghost" size="sm" onClick={onLoadMore}>
            {t("settings:repositoryBrowser.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
