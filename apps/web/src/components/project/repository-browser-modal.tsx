import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import getGitHubAppInfo from "@/fetchers/github-integration/get-app-info";
import listRepositories, {
  type ListRepositoriesResponse,
} from "@/fetchers/github-integration/list-repositories";
import { cn } from "@/lib/cn";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Clock,
  ExternalLink,
  GitBranch,
  Globe,
  Lock,
  Search,
  Settings,
  X,
} from "lucide-react";
import React from "react";

type RepositoryBrowserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectRepository: (repository: { owner: string; name: string }) => void;
  selectedRepository?: string;
};

export function RepositoryBrowserModal({
  open,
  onOpenChange,
  onSelectRepository,
  selectedRepository,
}: RepositoryBrowserModalProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["github-repositories"],
    queryFn: listRepositories,
    enabled: open,
  });

  const { data: appInfo } = useQuery({
    queryKey: ["github-app-info"],
    queryFn: getGitHubAppInfo,
    enabled: open,
  });

  const filteredRepositories = React.useMemo(() => {
    if (!data?.repositories) return [];

    if (!searchTerm) return data.repositories;

    const search = searchTerm.toLowerCase();
    return data.repositories.filter(
      (repo) =>
        repo.full_name.toLowerCase().includes(search) ||
        repo.description?.toLowerCase().includes(search),
    );
  }, [data?.repositories, searchTerm]);

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

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString();
  };

  const resetAndCloseModal = (open: boolean) => {
    if (!open) {
      setSearchTerm("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog.Root open={open} onOpenChange={resetAndCloseModal}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[85vh]">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 flex flex-col h-full max-h-[85vh]">
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Select Repository
                </Dialog.Title>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Choose a repository where your GitHub App is installed to
                  enable issue creation.
                </p>
              </div>
              <Dialog.Close className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300">
                <X size={20} />
              </Dialog.Close>
            </div>

            <div className="flex-shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
                <Input
                  placeholder="Search repositories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white dark:bg-zinc-800/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div
                      key={`loading-skeleton-repo-${i}-${Date.now()}`}
                      className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg animate-pulse"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                        <div className="flex-1">
                          <div className="w-48 h-4 bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
                          <div className="w-32 h-3 bg-zinc-200 dark:bg-zinc-700 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="text-center py-12">
                  <div className="text-red-600 dark:text-red-400 mb-3 font-medium">
                    Failed to load repositories
                  </div>
                  <Button variant="outline" onClick={() => refetch()}>
                    Try Again
                  </Button>
                </div>
              )}

              {data && !isLoading && (
                <>
                  {data.repositories.length === 0 && (
                    <div className="text-center py-12">
                      <GitBranch className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                        No repositories found
                      </h3>
                      <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-md mx-auto">
                        Install the GitHub App on your repositories to see them
                        here.
                      </p>
                      {appInfo?.appName && (
                        <Button
                          onClick={() =>
                            window.open(
                              `https://github.com/apps/${appInfo.appName}`,
                              "_blank",
                            )
                          }
                          className="bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Install GitHub App
                        </Button>
                      )}
                    </div>
                  )}

                  {filteredRepositories.length > 0 && (
                    <div className="p-4 space-y-2">
                      {filteredRepositories.map((repository) => (
                        <button
                          key={repository.id}
                          type="button"
                          onClick={() => handleSelectRepository(repository)}
                          className={cn(
                            "w-full p-3 border rounded-lg text-left transition-all duration-200 group",
                            "hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                            "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900",
                            selectedRepository === repository.full_name
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-400"
                              : "border-zinc-200 dark:border-zinc-700",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Avatar className="w-8 h-8 flex-shrink-0">
                                <AvatarImage
                                  src={repository.owner.avatar_url}
                                />
                                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                  {repository.owner.login
                                    .charAt(0)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                    {repository.full_name}
                                  </span>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {repository.private ? (
                                      <Lock className="w-3 h-3 text-zinc-400" />
                                    ) : (
                                      <Globe className="w-3 h-3 text-zinc-400" />
                                    )}
                                    <Badge
                                      variant="secondary"
                                      className="text-xs bg-zinc-100 dark:bg-zinc-800"
                                    >
                                      {repository.owner.type}
                                    </Badge>
                                  </div>
                                </div>

                                {repository.description && (
                                  <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate mb-1">
                                    {repository.description}
                                  </p>
                                )}

                                <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-500">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Updated{" "}
                                    {formatTimeAgo(repository.updated_at)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                              {selectedRepository === repository.full_name && (
                                <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(repository.html_url, "_blank");
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

                  {filteredRepositories.length === 0 &&
                    data.repositories.length > 0 && (
                      <div className="text-center py-12">
                        <Search className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                          No repositories match your search
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400">
                          Try adjusting your search terms or clear the search to
                          see all repositories.
                        </p>
                      </div>
                    )}
                </>
              )}
            </div>

            {data && data.installations.length > 0 && (
              <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800 p-4">
                <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                  <span>
                    {data.repositories.length} repositories across{" "}
                    {data.installations.length} installations
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
                    className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Manage Installations
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
