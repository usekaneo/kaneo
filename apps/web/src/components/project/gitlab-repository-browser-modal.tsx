import { useQuery } from "@tanstack/react-query";
import { ExternalLink, GitBranch, Lock, Search } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import listGitlabRepositories, {
  type ListGitlabRepositoriesResponse,
} from "@/fetchers/gitlab-integration/list-gitlab-repositories";
import { cn } from "@/lib/cn";

type GitlabRepositoryBrowserModalProps = {
  open: boolean;
  projectId: string;
  onOpenChange: (open: boolean) => void;
  onSelectRepository: (repository: { repositoryPath: string }) => void;
  selectedRepository?: string;
  baseUrl: string;
  accessToken: string;
};

export function GitlabRepositoryBrowserModal({
  open,
  projectId,
  onOpenChange,
  onSelectRepository,
  selectedRepository,
  baseUrl,
  accessToken,
}: GitlabRepositoryBrowserModalProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = React.useState("");

  const canFetch =
    open && baseUrl.trim().length > 0 && accessToken.trim().length > 0;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["gitlab-repositories", projectId, baseUrl],
    queryFn: () => listGitlabRepositories({ projectId, baseUrl, accessToken }),
    enabled: canFetch,
  });

  const filteredRepositories = React.useMemo(() => {
    if (!data?.repositories) return [];

    if (!searchTerm) return data.repositories;

    const search = searchTerm.toLowerCase();
    return data.repositories.filter((repo) =>
      repo.path_with_namespace.toLowerCase().includes(search),
    );
  }, [data?.repositories, searchTerm]);

  const handleSelectRepository = (
    repository: ListGitlabRepositoriesResponse["repositories"][number],
  ) => {
    onSelectRepository({ repositoryPath: repository.path_with_namespace });
    resetAndCloseModal(false);
  };

  const resetAndCloseModal = (next: boolean) => {
    if (!next) {
      setSearchTerm("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndCloseModal}>
      <DialogContent className="!max-w-2xl max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-5" />
            {t("settings:gitlabIntegration.browseModalTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("settings:gitlabIntegration.browseModalHint")}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("settings:gitlabIntegration.searchRepos")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-border px-6 py-2">
          {!canFetch && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("settings:gitlabIntegration.browseNeedsCredentials")}
            </p>
          )}
          {canFetch && isLoading && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("settings:gitlabIntegration.loadingRepos")}
            </p>
          )}
          {canFetch && error && (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm text-destructive">
                {error instanceof Error ? error.message : "Error"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                {t("settings:gitlabIntegration.retry")}
              </Button>
            </div>
          )}
          {canFetch && data && (
            <ul className="space-y-1">
              {filteredRepositories.map((repo) => (
                <li key={repo.id}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectRepository(repo)}
                      className={cn(
                        "flex-1 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/80 transition-colors",
                        selectedRepository === repo.path_with_namespace &&
                          "bg-muted",
                      )}
                    >
                      <span className="font-medium truncate">
                        {repo.path_with_namespace}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {repo.visibility !== "public" ? (
                          <Lock className="size-3.5 text-muted-foreground" />
                        ) : null}
                        <Badge variant="secondary" className="text-xs">
                          {repo.visibility}
                        </Badge>
                      </div>
                    </button>
                    <a
                      href={repo.web_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-2 text-primary hover:bg-muted/80 transition-colors"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
