import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { filterByName } from "@/components/project/code-hosting/picker/filter-by-name";
import { RepositoryPickerDialog } from "@/components/project/code-hosting/picker/repository-picker-dialog";
import { RepositoryPickerSearch } from "@/components/project/code-hosting/picker/repository-picker-search";
import { GiteaRepositoryResults } from "@/components/project/gitea-integration/gitea-repository-results";
import listGiteaRepositories, {
  type ListGiteaRepositoriesResponse,
} from "@/fetchers/gitea-integration/list-gitea-repositories";
import { authClient } from "@/lib/auth-client";

type GiteaRepository = ListGiteaRepositoriesResponse["repositories"][number];

type GiteaRepositoryPickerProps = {
  open: boolean;
  projectId: string;
  onOpenChange: (open: boolean) => void;
  onSelectRepository: (repository: { owner: string; name: string }) => void;
  selectedRepository?: string;
  baseUrl: string;
  accessToken: string;
};

export function GiteaRepositoryPicker({
  open,
  projectId,
  onOpenChange,
  onSelectRepository,
  selectedRepository,
  baseUrl,
  accessToken,
}: GiteaRepositoryPickerProps) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<GiteaRepository | null>(null);
  const { data: session } = authClient.useSession();
  const credentials = useMemo(
    () => ({ accessToken, cacheId: crypto.randomUUID() }),
    [accessToken],
  );
  const canFetch =
    open &&
    Boolean(session?.user.id) &&
    baseUrl.trim().length > 0 &&
    accessToken.trim().length > 0;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "gitea-repositories",
      session?.user.id,
      projectId,
      baseUrl,
      credentials.cacheId,
    ],
    queryFn: () =>
      listGiteaRepositories({
        projectId,
        baseUrl,
        accessToken: credentials.accessToken,
      }),
    enabled: canFetch,
    gcTime: 0,
    placeholderData: () => undefined,
  });

  const repositories = filterByName(
    data?.repositories ?? [],
    term,
    (repository) => repository.full_name,
  );
  const chosen =
    selected ??
    data?.repositories.find(
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

  const use = (repository: GiteaRepository | null) => {
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
      title={t("settings:codeHosting.chooseRepositoryTitle")}
      description={t("settings:giteaIntegration.browseModalHint")}
      search={
        <RepositoryPickerSearch
          value={term}
          placeholder={t("settings:repositoryBrowser.searchPlaceholder")}
          onChange={setTerm}
        />
      }
      confirmLabel={t("settings:repositoryBrowser.useRepository")}
      confirmDisabled={!chosen || !canFetch}
      onConfirm={() => use(chosen)}
    >
      <GiteaRepositoryResults
        canFetch={canFetch}
        isLoading={isLoading}
        error={canFetch ? error : null}
        loaded={canFetch && Boolean(data)}
        repositories={repositories}
        searching={term.trim() !== ""}
        selected={chosen?.full_name ?? null}
        onSelect={setSelected}
        onConfirm={use}
        onRetry={() => void refetch()}
      />
    </RepositoryPickerDialog>
  );
}
