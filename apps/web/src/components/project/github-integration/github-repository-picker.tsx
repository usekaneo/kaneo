import { ArrowUpRightIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RepositoryPickerDialog } from "@/components/project/code-hosting/picker/repository-picker-dialog";
import { RepositoryPickerSearch } from "@/components/project/code-hosting/picker/repository-picker-search";
import { GithubRepositoryResults } from "@/components/project/github-integration/github-repository-results";
import { useGithubAppInfo } from "@/components/project/github-integration/use-github-app-info";
import { useGithubRepositorySearch } from "@/components/project/github-integration/use-github-repository-search";
import type { GithubRepository } from "@/fetchers/github-integration/list-repositories";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type GithubRepositoryPickerProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectRepository: (repository: { owner: string; name: string }) => void;
  selectedRepository?: string;
};

export function GithubRepositoryPicker({
  projectId,
  open,
  onOpenChange,
  onSelectRepository,
  selectedRepository,
}: GithubRepositoryPickerProps) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<GithubRepository | null>(null);
  const search = useDebouncedValue(term.trim(), 300);
  const { data: appInfo } = useGithubAppInfo(open);
  const results = useGithubRepositorySearch({
    projectId,
    search,
    enabled: open,
  });
  const selectedName = selected?.full_name ?? selectedRepository ?? null;
  const chosen =
    selected ??
    results.repositories.find(
      (repository) => repository.full_name === selectedRepository,
    ) ??
    null;

  const changeOpen = (next: boolean) => {
    if (!next) {
      setTerm("");
      setSelected(null);
    }
    onOpenChange(next);
  };

  const use = (repository: GithubRepository | null) => {
    if (!repository) return;
    onSelectRepository({
      owner: repository.owner.login,
      name: repository.name,
    });
    changeOpen(false);
  };

  return (
    <RepositoryPickerDialog
      open={open}
      onOpenChange={changeOpen}
      title={t("settings:repositoryBrowser.title")}
      description={t("settings:repositoryBrowser.description")}
      search={
        <RepositoryPickerSearch
          value={term}
          placeholder={t("settings:repositoryBrowser.searchPlaceholder")}
          onChange={setTerm}
        />
      }
      footerStart={
        <span className="flex items-center gap-1.5">
          {t("settings:repositoryBrowser.missingOne")}
          <a
            href="https://github.com/settings/installations"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
          >
            {t("settings:repositoryBrowser.manageAccess")}
            <ArrowUpRightIcon aria-hidden="true" className="size-3" />
          </a>
        </span>
      }
      confirmLabel={t("settings:repositoryBrowser.useRepository")}
      confirmDisabled={!chosen}
      onConfirm={() => use(chosen)}
    >
      <GithubRepositoryResults
        repositories={results.repositories}
        searching={search !== ""}
        isPending={results.isPending}
        isError={results.isError}
        isFetchNextPageError={results.isFetchNextPageError}
        hasNextPage={results.hasNextPage}
        fetchingMore={results.fetchingMore}
        appName={appInfo?.appName}
        selected={selectedName}
        onSelect={setSelected}
        onConfirm={use}
        onRetry={() => void results.refetch()}
        onLoadMore={() => void results.fetchNextPage()}
      />
    </RepositoryPickerDialog>
  );
}
