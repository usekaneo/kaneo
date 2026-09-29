import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Check,
  Clock,
  ExternalLink,
  GitBranch,
  Globe,
  Lock,
  Search,
  Settings,
} from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Separator } from "@/components/ui/separator";
import getGitHubAppInfo from "@/fetchers/github-integration/get-app-info";
import listRepositories, {
  type ListRepositoriesResponse,
  type RepositoryPage,
} from "@/fetchers/github-integration/list-repositories";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { openExternalWebUrl } from "@/lib/external-url";
import { getInitials } from "@/lib/get-initials";

const FIRST_PAGE: RepositoryPage = { installationPage: 1, repositoryPage: 1 };
const SEARCH_PAGE_BATCH = 10;

type RepositoryBrowserModalProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectRepository: (repository: { owner: string; name: string }) => void;
  selectedRepository?: string;
};

export function RepositoryBrowserModal({
  projectId,
  open,
  onOpenChange,
  onSelectRepository,
  selectedRepository,
}: RepositoryBrowserModalProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [searchBudget, setSearchBudget] = React.useState({
    search: "",
    pages: SEARCH_PAGE_BATCH,
  });
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [pageHistory, setPageHistory] = React.useState<RepositoryPage[]>([
    FIRST_PAGE,
  ]);
  const page = pageHistory[pageHistory.length - 1] ?? FIRST_PAGE;

  React.useEffect(() => {
    const timeout = setTimeout(
      () => setSearch(searchTerm.trim().toLowerCase()),
      300,
    );
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const pageQuery = useQuery({
    queryKey: ["github-repositories", projectId, userId, page],
    queryFn: () => listRepositories(projectId, page),
    enabled: open && Boolean(userId) && !search,
  });

  const searchQuery = useInfiniteQuery({
    queryKey: ["github-repositories", projectId, userId, "search", search],
    queryFn: ({ pageParam }) => listRepositories(projectId, pageParam, search),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    enabled: open && Boolean(userId) && Boolean(search),
  });

  const searchPageLimit =
    searchBudget.search === search ? searchBudget.pages : SEARCH_PAGE_BATCH;
  const searchedPages = searchQuery.data?.pages.length ?? 0;
  const continueSearch =
    Boolean(search) &&
    searchQuery.hasNextPage &&
    !searchQuery.isError &&
    searchedPages < searchPageLimit;
  const { fetchNextPage, isFetching: isFetchingSearch } = searchQuery;

  React.useEffect(() => {
    if (continueSearch && !isFetchingSearch) fetchNextPage();
  }, [continueSearch, isFetchingSearch, fetchNextPage, searchedPages]);

  const searchData = React.useMemo(() => {
    const pages = searchQuery.data?.pages;
    if (!pages) return undefined;
    const installations = new Map(
      pages
        .flatMap((result) => result.installations)
        .map((installation) => [installation.id, installation]),
    );
    return {
      repositories: pages.flatMap((result) => result.repositories),
      installations: [...installations.values()],
    };
  }, [searchQuery.data?.pages]);

  const data = search ? searchData : pageQuery.data;
  const { isLoading, error, refetch } = search ? searchQuery : pageQuery;
  const isSearching =
    Boolean(search) && (continueSearch || searchQuery.isFetchingNextPage);
  const canSearchMore =
    Boolean(search) &&
    searchQuery.hasNextPage &&
    !isSearching &&
    !searchQuery.isError;

  const { data: appInfo } = useQuery({
    queryKey: ["github-app-info", userId],
    queryFn: getGitHubAppInfo,
    enabled: open,
  });

  const handleSelectRepository = (
    repository: ListRepositoriesResponse["repositories"][number],
  ) => {
    onSelectRepository({
      owner: repository.owner.login,
      name: repository.name,
    });
    onOpenChange(false);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60)
      return t("settings:repositoryBrowser.relativeJustNow");
    if (diffInSeconds < 3600) {
      return t("settings:repositoryBrowser.relativeMinutesAgo", {
        count: Math.floor(diffInSeconds / 60),
      });
    }
    if (diffInSeconds < 86400) {
      return t("settings:repositoryBrowser.relativeHoursAgo", {
        count: Math.floor(diffInSeconds / 3600),
      });
    }
    if (diffInSeconds < 2592000) {
      return t("settings:repositoryBrowser.relativeDaysAgo", {
        count: Math.floor(diffInSeconds / 86400),
      });
    }

    return date.toLocaleDateString();
  };

  const resetAndCloseModal = (open: boolean) => {
    if (!open) {
      setSearchTerm("");
      setSearch("");
      setPageHistory([FIRST_PAGE]);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndCloseModal}>
      <DialogContent className="!max-w-2xl max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            {t("settings:repositoryBrowser.title")}
          </DialogTitle>
          <DialogDescription className="mt-1.5">
            {t("settings:repositoryBrowser.description")}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="px-6 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t("settings:repositoryBrowser.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Separator />

        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {isLoading && (
            <div className="px-6 py-4 space-y-3">
              {[0, 1, 2, 3, 4].map((slot) => (
                <div
                  key={`loading-skeleton-repo-${slot}`}
                  className="p-4 border border-border rounded-md bg-sidebar animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-muted rounded-full" />
                    <div className="flex-1">
                      <div className="w-48 h-4 bg-muted rounded mb-2" />
                      <div className="w-32 h-3 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-12 px-6">
              <div className="text-destructive mb-3 font-medium">
                {t("settings:repositoryBrowser.loadError")}
              </div>
              <Button variant="outline" onClick={() => refetch()}>
                {t("settings:repositoryBrowser.tryAgain")}
              </Button>
            </div>
          )}

          {data && !isLoading && (
            <>
              {!search && data.repositories.length === 0 && (
                <div className="text-center py-12 px-6">
                  <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {t("settings:repositoryBrowser.emptyTitle")}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                    {t("settings:repositoryBrowser.emptyHint")}
                  </p>
                  {appInfo?.appName && (
                    <Button
                      onClick={() =>
                        window.open(
                          `https://github.com/apps/${appInfo.appName}`,
                          "_blank",
                        )
                      }
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {t("settings:repositoryBrowser.installGithubApp")}
                    </Button>
                  )}
                </div>
              )}

              {data.repositories.length > 0 && (
                <div className="px-6 py-4 space-y-2">
                  {data.repositories.map((repository) => (
                    <button
                      key={repository.id}
                      type="button"
                      onClick={() => handleSelectRepository(repository)}
                      className={cn(
                        "w-full p-4 border rounded-md text-left transition-colors group bg-sidebar",
                        "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        selectedRepository === repository.full_name
                          ? "border-primary bg-accent"
                          : "border-border",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={repository.owner.avatar_url} />
                            <AvatarFallback>
                              {getInitials(repository.owner.login)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium truncate">
                                {repository.full_name}
                              </span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {repository.private ? (
                                  <Lock className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                  <Globe className="w-3 h-3 text-muted-foreground" />
                                )}
                                <Badge variant="secondary" className="text-xs">
                                  {repository.owner.type}
                                </Badge>
                              </div>
                            </div>

                            {repository.description && (
                              <p className="text-sm text-muted-foreground truncate mb-1">
                                {repository.description}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {t(
                                  "settings:repositoryBrowser.updatedPrefix",
                                )}{" "}
                                {formatTimeAgo(repository.updated_at)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {selectedRepository === repository.full_name && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openExternalWebUrl(repository.html_url);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {isSearching && (
                <div className="px-6 pb-4 text-center text-sm text-muted-foreground">
                  {t("settings:repositoryBrowser.searching")}
                </div>
              )}

              {search && !isSearching && data.repositories.length === 0 && (
                <div className="text-center py-12 px-6">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {t("settings:repositoryBrowser.noSearchMatchTitle")}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {t("settings:repositoryBrowser.noSearchMatchHint")}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {canSearchMore && (
          <div className="flex justify-center border-t px-6 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSearchBudget({
                  search,
                  pages: searchPageLimit + SEARCH_PAGE_BATCH,
                })
              }
            >
              {t("settings:repositoryBrowser.searchMore")}
            </Button>
          </div>
        )}
        {!search && pageQuery.data && (
          <div className="flex items-center justify-between gap-2 border-t px-6 py-3">
            <Button
              type="button"
              variant="outline"
              disabled={pageHistory.length <= 1}
              onClick={() => setPageHistory((pages) => pages.slice(0, -1))}
            >
              {t("common:pagination.previous")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!pageQuery.data.nextPage}
              onClick={() => {
                const next = pageQuery.data.nextPage;
                if (next) setPageHistory((pages) => [...pages, next]);
              }}
            >
              {t("common:pagination.next")}
            </Button>
          </div>
        )}
        {data && data.installations.length > 0 && (
          <>
            <Separator />
            <div className="px-6 py-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {t("settings:repositoryBrowser.footerSummary", {
                    repoCount: data.repositories.length,
                    installationCount: data.installations.length,
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    window.open(
                      "https://github.com/settings/installations",
                      "_blank",
                    )
                  }
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {t("settings:repositoryBrowser.manageInstallations")}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
