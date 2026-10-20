import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { filterByName } from "@/components/project/code-hosting/picker/filter-by-name";
import { RepositoryPickerDialog } from "@/components/project/code-hosting/picker/repository-picker-dialog";
import { RepositoryPickerSearch } from "@/components/project/code-hosting/picker/repository-picker-search";
import type { GitlabTokenType } from "@/components/project/gitlab-integration/gitlab-access";
import { GitlabProjectResults } from "@/components/project/gitlab-integration/gitlab-project-results";
import listGitlabProjects, {
  type ListGitlabProjectsResponse,
} from "@/fetchers/gitlab-integration/list-gitlab-projects";
import { tokenFingerprint } from "@/lib/token-fingerprint";

type GitlabProject = ListGitlabProjectsResponse["projects"][number];

type GitlabProjectPickerProps = {
  open: boolean;
  projectId: string;
  onOpenChange: (open: boolean) => void;
  onSelectProject: (projectPath: string) => void;
  selectedProjectPath?: string;
  baseUrl: string;
  accessToken: string;
  tokenType: GitlabTokenType;
};

export function GitlabProjectPicker({
  open,
  projectId,
  onOpenChange,
  onSelectProject,
  selectedProjectPath,
  baseUrl,
  accessToken,
  tokenType,
}: GitlabProjectPickerProps) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<GitlabProject | null>(null);
  const canFetch =
    open && baseUrl.trim().length > 0 && accessToken.trim().length > 0;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "gitlab-projects",
      projectId,
      baseUrl,
      tokenType,
      tokenFingerprint(accessToken),
    ],
    queryFn: () =>
      listGitlabProjects({ projectId, baseUrl, accessToken, tokenType }),
    enabled: canFetch,
    gcTime: 0,
  });

  const projects = filterByName(
    data?.projects ?? [],
    term,
    (project) => project.path_with_namespace,
  );
  const chosen =
    selected ??
    data?.projects.find(
      (project) => project.path_with_namespace === selectedProjectPath,
    ) ??
    null;

  const changeOpen = (next: boolean) => {
    if (!next) {
      setTerm("");
      setSelected(null);
    }
    onOpenChange(next);
  };

  const use = (project: GitlabProject | null) => {
    if (!project) return;
    onSelectProject(project.path_with_namespace);
    changeOpen(false);
  };

  return (
    <RepositoryPickerDialog
      open={open}
      onOpenChange={changeOpen}
      title={t("settings:codeHosting.chooseProjectTitle")}
      description={t("settings:gitlabIntegration.browseModalHint")}
      search={
        <RepositoryPickerSearch
          value={term}
          placeholder={t("settings:gitlabIntegration.searchProjects")}
          onChange={setTerm}
        />
      }
      confirmLabel={t("settings:gitlabIntegration.useProject")}
      confirmDisabled={!chosen || !canFetch}
      onConfirm={() => use(chosen)}
    >
      <GitlabProjectResults
        canFetch={canFetch}
        isLoading={isLoading}
        error={canFetch ? error : null}
        loaded={canFetch && Boolean(data)}
        projects={projects}
        searching={term.trim() !== ""}
        selected={chosen?.path_with_namespace ?? null}
        onSelect={setSelected}
        onConfirm={use}
        onRetry={() => void refetch()}
      />
    </RepositoryPickerDialog>
  );
}
