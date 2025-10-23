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
} from "lucide-react";
import React from "react";
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
} from "@/fetchers/github-integration/list-repositories";
import { cn } from "@/lib/cn";

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
    <Dialog open={open} onOpenChange={resetAndCloseModal}>
      <DialogContent className="!max-w-2xl max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Select Repository
          </DialogTitle>
          <DialogDescription className="mt-1.5">
            Choose a repository where your GitHub App is installed to enable
            issue synchronization.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="px-6 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search repositories..."
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
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={`loading-skeleton-repo-${i}-${Date.now()}`}
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
                <div className="text-center py-12 px-6">
                  <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    No repositories found
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
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
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Install GitHub App
                    </Button>
                  )}
                </div>
              )}

              {filteredRepositories.length > 0 && (
                <div className="px-6 py-4 space-y-2">
                  {filteredRepositories.map((repository) => (
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
                              {repository.owner.login.charAt(0).toUpperCase()}
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
                                Updated {formatTimeAgo(repository.updated_at)}
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
                  <div className="text-center py-12 px-6">
                    <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      No repositories match your search
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Try adjusting your search terms or clear the search to see
                      all repositories.
                    </p>
                  </div>
                )}
            </>
          )}
        </div>

        {data && data.installations.length > 0 && (
          <>
            <Separator />
            <div className="px-6 py-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
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
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Installations
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
